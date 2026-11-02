#!/bin/sh
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo
  echo " O Node.js não foi encontrado neste computador."
  echo " Baixe e instale (grátis, versão LTS) em https://nodejs.org e rode este arquivo de novo."
  echo
  exit 1
fi

node servidor.js
