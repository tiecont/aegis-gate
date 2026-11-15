package transport

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"testing"
)

func TestFixtureHTTPErrorDoesNotExposeOIDCCallback(t *testing.T) {
	err := fmt.Errorf("fixture: %w", &url.Error{Op: "Get",
		URL: "https://127.0.0.1/v1/callback?code=fixture-code-sentinel&state=fixture-state-sentinel",
		Err: context.DeadlineExceeded})
	message := fixtureHTTPError(err)
	for _, private := range []string{"fixture-code-sentinel", "fixture-state-sentinel", "callback?", "127.0.0.1"} {
		if strings.Contains(message, private) {
			t.Fatal("HTTP fixture error exposed request URL")
		}
	}
	if !strings.Contains(message, context.DeadlineExceeded.Error()) {
		t.Fatal("HTTP fixture error lost timeout diagnosis")
	}
}
