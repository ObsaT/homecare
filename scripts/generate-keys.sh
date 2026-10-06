#!/usr/bin/env bash
# Generate a development RSA key pair for RS256 access-token signing.
#
# The API needs a private key to sign and a public key to verify. In development this is a fixed
# key on disk; in production these live in the secrets store (docs/11-security.md § 1). The domain
# field defaults to the documented API hostname; the JWT verification path does not check it, so it
# is cosmetic here.

set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .secrets
KEY="${JWT_KEY_DIR:-.secrets}"
openssl genrsa -out "$KEY/jwt-private.pem" 2048 >/dev/null 2>&1
openssl rsa -in "$KEY/jwt-private.pem" -pubout -out "$KEY/jwt-public.pem" >/dev/null 2>&1
chmod 600 "$KEY/jwt-private.pem"
echo "wrote $KEY/jwt-private.pem and $KEY/jwt-public.pem"