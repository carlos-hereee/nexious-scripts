#!/bin/bash
# Define function for searching files in a directory
require_pattern() {
  # Check if second argument is provided
  if [ -z "$pattern" ]; then
    echo -e "Error Occured:  second argument is not provided"
    echo -e "Old file extension name is $pattern"
    echo -e "Posible Fix: change value to desired schema 'jsx' or similar"
    # Exit Code 1: This is often used to indicate a general error.
    return 1
  fi
  # Check if third argument is provided
  if [ -z "$newName" ]; then
    echo -e "Error Occured:  thrid argument is not provided"
    echo -e "Old file extension name is $newName"
    echo -e "Posible Fix: change value to desired schema {jsx} or similar"
    # Exit Code 1: This is often used to indicate a general error.
    exit 1
  fi
}
