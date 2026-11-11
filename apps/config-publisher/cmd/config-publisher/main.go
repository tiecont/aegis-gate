// Foundation offline executable only. No snapshot publication or trust decision.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"

	"aegisgate.dev/aegisgate/internal/contracts"
)

func main() {
	check := flag.Bool("check", false, "emit foundation transport contract and exit; never publishes config")
	flag.Parse()
	if !*check {
		fmt.Fprintln(os.Stderr, "publisher unavailable: signed publication gate not implemented")
		os.Exit(2)
	}
	id, err := contracts.RequestID()
	if err != nil {
		os.Exit(1)
	}
	if err := json.NewEncoder(os.Stdout).Encode(contracts.ErrorEnvelope{Error: contracts.ErrorDetail{Code: "not_ready", Message: "Publisher is not configured", RequestID: id}}); err != nil {
		os.Exit(1)
	}
}
