#!/bin/sh
# Verifies an eQMS backup export package WITHOUT the eQMS software.
# Needs: sha256sum, base64, openssl 3 (for Ed25519). Usage: sh tools/verify-chain.sh [package-folder]
# It proves the package is complete, unchanged, and signed by the eQMS Backup Agent key it carries.
# It does not decrypt anything: decrypting needs the private key held by the key holders.
set -u
cd "${1:-.}" || { echo "Cannot open the package folder"; exit 2; }
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
fail=0

echo "1. Every file against PACKAGE-SHA256SUMS"
if sha256sum -c PACKAGE-SHA256SUMS > "$T/sums.out" 2>&1; then
  echo "   OK: $(wc -l < PACKAGE-SHA256SUMS | tr -d ' ') files match"
else
  grep -v ': OK$' "$T/sums.out" | sed 's/^/   /'
  fail=1
fi

{ echo '-----BEGIN PUBLIC KEY-----'; cat public-keys/manifest-signing.pub; echo '-----END PUBLIC KEY-----'; } > "$T/pub.pem"

verify_sig() {
  base64 -d < "$2" > "$T/sig.bin" 2>/dev/null
  if openssl pkeyutl -verify -pubin -inkey "$T/pub.pem" -rawin -in "$1" -sigfile "$T/sig.bin" > /dev/null 2>&1; then
    echo "   OK: $1 is signed by the key in public-keys/"
  else
    echo "   FAILED: the signature of $1 does not verify"
    fail=1
  fi
}

echo "2. Signatures"
verify_sig manifest.json manifest.sig
verify_sig EXPORT-RECEIPT.json EXPORT-RECEIPT.sig

echo "3. The receipt matches what is in the folder"
want_sums="$(sed -n 's/.*"packageSumsSha256":"\([0-9a-f]*\)".*/\1/p' EXPORT-RECEIPT.json)"
have_sums="$(sha256sum PACKAGE-SHA256SUMS | cut -d' ' -f1)"
want_manifest="$(sed -n 's/.*"manifestSha256":"\([0-9a-f]*\)".*/\1/p' EXPORT-RECEIPT.json)"
have_manifest="$(sha256sum manifest.json | cut -d' ' -f1)"
if [ -n "$want_sums" ] && [ "$want_sums" = "$have_sums" ] && [ -n "$want_manifest" ] && [ "$want_manifest" = "$have_manifest" ]; then
  echo "   OK: checksum list and manifest are the ones the receipt names"
else
  echo "   FAILED: the receipt does not match the checksum list or the manifest"
  fail=1
fi

if [ "$fail" -eq 0 ]; then echo "RESULT: the package is complete, unchanged and signed."; else echo "RESULT: THE PACKAGE FAILED. Do not use it."; fi
exit "$fail"
