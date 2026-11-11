package main

import (
	"flag"
	"log"

	"aegisgate.dev/aegisgate/packages/test-fixtures/internal/lab"
)

func main() {
	dir := flag.String("out", ".local/pki", "NEW output directory (private, unsafe lab fixtures)")
	flag.Parse()
	if err := lab.Generate(*dir); err != nil {
		log.Fatal(err)
	}
	log.Print("unsafe local fixtures generated; material not logged")
}
