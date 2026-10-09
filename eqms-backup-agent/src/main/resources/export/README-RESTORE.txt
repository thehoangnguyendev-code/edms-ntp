eQMS BACKUP EXPORT PACKAGE
==========================

This folder is a self-contained copy of one eQMS backup. It was written by the eQMS Backup Agent
and approved by two different people. Everything that holds data is encrypted; only the manifest,
the checksums and the receipt are readable.

CONTENTS
  database/eqms.dump.gpg         the database, encrypted
  objects/index.json.gpg         the list of every stored document version, encrypted
  objects/<bucket>/<xx>/<id>.gpg every document version the backup refers to, encrypted
  manifest.json, manifest.sig    what the backup contains, and its signature
  SHA256SUMS                     checksums written when the backup was made
  PACKAGE-SHA256SUMS             checksums of every file in this folder
  EXPORT-RECEIPT.json/.sig       written last; a package without a valid receipt is not valid
  public-keys/                   the public key that signs the manifest and the receipt
  tools/verify-chain.sh|.ps1     check the package without the eQMS software

STEP 1 - CHECK THE PACKAGE (no key needed)
  sh tools/verify-chain.sh .        (needs sha256sum, base64 and openssl 3)
  On Windows only the file checks are possible:  powershell -File tools\verify-chain.ps1
  Any FAILED line means: do not use this package, and tell the Backup Administrator.

STEP 2 - DECRYPT (needs the private backup key)
  The private key is held by the key holders named in the eQMS Storage & Encryption screen.
  Two of them must be present. The eQMS system never holds this key.
  Example for the database:   gpg --decrypt database/eqms.dump.gpg > eqms.dump
  Then restore with:          pg_restore --no-owner -d <new empty database> eqms.dump

STEP 3 - DOCUMENTS
  objects/index.json.gpg lists, for every document version, its bucket, name, version, SHA-256 and
  the file under objects/ that holds it. Decrypt a file and compare its SHA-256 with the list.

Putting this package back into a running eQMS ("Register Imported Set") is a controlled procedure
that is not part of this folder; it requires an approved restore request.
