#!/bin/zsh
# Lokaler Dev-Server (gegen die PRODUKTIONS-DB — Crons bleiben durch
# fiaon-crons.ts aus, solange NODE_ENV nicht production ist).
cd ~/Developer/fiaon-plattform
set -a; source .env; set +a
# Lokal IMMER die externe DB-Adresse — die interne (dpg-…-a) löst nur innerhalb Renders auf.
export DATABASE_URL="${DATABASE_URL_EXTERN:-$DATABASE_URL}"
PORT=5173 npm run dev
