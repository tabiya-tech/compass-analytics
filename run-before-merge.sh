#!/bin/bash
NC='\033[0m' # No Color

function frontend() {
  local project="frontend"
  printTitle "${project}"
  (cd frontend/ && yarn install && yarn run format:check && yarn run lint && yarn run compile && yarn run test && yarn run build)
  if [ $? -ne 0 ]; then
    printError "${project}"
    exit 1
  fi
  printSuccess "${project}"
}

function backend() {
  local project="backend"
  printTitle "${project}"
  (cd backend/ && poetry sync --no-interaction && poetry run bandit -c bandit.yaml -r . && poetry run pylint --exit-zero --recursive=y . && poetry run pytest -m "not smoke_test")
  if [ $? -ne 0 ]; then
    printError "${project}"
    exit 1
  fi
  printSuccess "${project}"
}

function printTitle() {
  local blue='\033[1;30;44m'
  local title="Begin to build the ${1}"
  printf "${blue}$(getSpaces "${title}")${NC}\n"
  printf "${blue}${title}${NC}\n"
  printf "${blue}$(getSpaces "${title}")${NC}\n"
}
function getSpaces() {
  local length=${#1}
  echo "%${length}s"
}

function printSuccess() {
  local green='\033[1;32;42m'
  local txt="Building the ${1} succeeded!"
  printf "${green}$(getSpaces "${txt}")${NC}\n"
  printf "${green}${txt}${NC}\n"
  printf "${green}$(getSpaces "${txt}")${NC}\n"
}

function printError() {
  local red='\033[1;31;41m'
  local txt="Building the ${1} failed!"
  printf "${red}$(getSpaces "${txt}")${NC}\n"
  printf "${red}${txt}${NC}\n"
  printf "${red}$(getSpaces "${txt}")${NC}\n"
}

PS3="Select what you want to build and test: "

# NOTE: iac is not implemented yet. Add a function for it here (following the
# `frontend`/`backend` functions above as a template) once it exists, and add
# a matching option below.
OPTIONS="All Frontend Backend"

select opt in $OPTIONS; do
  if [ "$REPLY" = "1" ]; then
    echo "******************"
    echo "Building all"
    echo "******************"
    frontend && backend
    exit $?
  elif [ "$REPLY" = "2" ]; then
    frontend
    exit $?
  elif [ "$REPLY" = "3" ]; then
    backend
    exit $?
  else
    clear
    echo bad option
  fi
done
