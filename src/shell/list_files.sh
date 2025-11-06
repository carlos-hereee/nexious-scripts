#!/bin/bash
# recersively list files and subtitles
list_files() {
  local dir="$1"
  echo -e "Searching directory: $dir"
  # loop through files in path
  for file in "$dir"/*; do
    # check if current file is a file
    if [ -f "$file" ]; then
      # print its path
      echo -e "Checking file "$file""
    # check if current file is a directory
    elif [ -d "$file" ]; then
      # rinse and repeat
      echo -e "Directory found "$file""
      list_files "$file"
    fi
  done
}
