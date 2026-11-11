package transport

import (
	"encoding/json"
	"net/url"
	"os"
	"regexp"
	"strings"
	"testing"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

func assertResponseContract(t *testing.T, method, path string, status int, raw []byte) {
	t.Helper()
	data, err := os.ReadFile("../../../../packages/contracts/openapi.json")
	if err != nil {
		t.Fatal(err)
	}
	var spec map[string]any
	if json.Unmarshal(data, &spec) != nil {
		t.Fatal("invalid OpenAPI")
	}
	parsed, err := url.Parse(path)
	if err != nil {
		t.Fatal(err)
	}
	var operation map[string]any
	for pattern, methods := range spec["paths"].(map[string]any) {
		left, right := strings.Split(pattern, "/"), strings.Split(parsed.Path, "/")
		if len(left) != len(right) {
			continue
		}
		match := true
		for index, part := range left {
			if !strings.HasPrefix(part, "{") && part != right[index] {
				match = false
				break
			}
		}
		if match {
			operation, _ = methods.(map[string]any)[strings.ToLower(method)].(map[string]any)
			if operation != nil {
				break
			}
		}
	}
	if operation == nil {
		t.Fatal("implemented endpoint absent from OpenAPI", method, parsed.Path)
	}
	var schema any
	if status == 200 {
		schema = operation["responses"].(map[string]any)["200"].(map[string]any)["content"].(map[string]any)["application/json"].(map[string]any)["schema"]
	} else {
		schema = map[string]any{"$ref": "#/components/schemas/ErrorEnvelope"}
	}
	document := map[string]any{"$schema": "http://json-schema.org/draft-07/schema#", "components": spec["components"], "allOf": []any{schema}}
	compiler := jsonschema.NewCompiler()
	// OpenAPI patterns use ECMA Unicode escapes; Go's RE2 represents the same
	// code points with braced hexadecimal escapes. Keep the source schema intact.
	unicodeEscape := regexp.MustCompile(`\\u([[:xdigit:]]{4})`)
	compiler.UseRegexpEngine(func(pattern string) (jsonschema.Regexp, error) {
		return regexp.Compile(unicodeEscape.ReplaceAllString(pattern, `\x{$1}`))
	})
	if err = compiler.AddResource("https://contracts.invalid/response.json", document); err != nil {
		t.Fatal(err)
	}
	compiled, err := compiler.Compile("https://contracts.invalid/response.json")
	if err != nil {
		t.Fatal(err)
	}
	var value any
	if json.Unmarshal(raw, &value) != nil {
		t.Fatal("non-JSON management response")
	}
	if err = compiled.Validate(value); err != nil {
		t.Fatal("HTTP response disagrees with OpenAPI", err)
	}
}
