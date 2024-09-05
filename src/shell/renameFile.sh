#!/bin/bash
# # Total number of arguments
# num_args="$#"
# # All arguments as a single string
# all_args="$*"
# # All arguments as an array
# args_array=("$@")
# # # Accessing the filename
# filename="$0"

# KEY VARIABLES
# Get the current directory path
current_dir=$(pwd)
node_module="node_modules/nexious-library/"
# # Accessing the first argument PATH
input_path=""$current_dir"/""$1"
# # remove node_modules from string if exists
path="${input_path//"$node_module"/}"
# # Accessing the second argument
pattern="$2"
# # Accessing the third argument
newName="$3"

# for error handling, check if path exists, and directory
require_path() {
  # Check if the first argument is provided and not empty
  # # -z is the test operator to check if path is empty
  if [ -z "$path" ]; then
    echo "Error Occured: first argument is not provided"
    echo "Posible Fix: update first arg. value to desired schema path or path/to/directory"
    # Exit Code 1: This is often used to indicate a general error.
    # If a program or script encounters an unspecified or unexpected issue,
    # it may return an exit code of 1 to signal a problem without providing specific details.
    return 1
  else
    # first argument is path and it exists. Check if folder exists
    # ! -d checks if the directory does not exist
    if [ ! -d "$path" ]; then
      echo "No directory found on path "$path""
      return 1
    else
      # passed all errors start next process
      echo "Found directory on path "$path""
    fi
  fi
}
# Define function for searching files in a directory
require_pattern() {
  # Check if second argument is provided
  if [ -z "$pattern" ]; then
    echo "Error Occured:  second argument is not provided"
    echo "Old file extension name is $pattern"
    echo "Posible Fix: change value to desired schema 'jsx' or similar"
    # Exit Code 1: This is often used to indicate a general error.
    return 1
  fi
}
require_new_name() {
  # Check if third argument is provided
  if [ -z "$newName" ]; then
    echo "Error Occured:  thrid argument is not provided"
    echo "Old file extension name is $newName"
    echo "Posible Fix: change value to desired schema {jsx} or similar"
    # Exit Code 1: This is often used to indicate a general error.
    exit 1
  fi
}

# count the number of files matching search critiria and count them
count_files_matching_criteria() {
  local count
  count=$(find "$path" -type f -name "*.{$pattern}" | wc -l)
  # if any matching files were found
  if [ "$count" -gt 0 ]; then
    # do things
    echo "Files found "$count" matching the search criteria "$pattern""
  else
    # No files found
    echo ""$count" files found matching search criteria"
    # echo "You are in the directory: "$path""
    return 1
  fi
}
rename_file() {
  local current_filename="$1"
  # # remove string from the original string if exists
  # local filename_with_extension="$current_filename"""$pattern""
  local clip_filename_extension="${current_filename//${pattern}/}"
  local file_with_new_extension="$clip_filename_extension"""$newName""
  # echo "current filename "$current_filename""
  # echo "newfilename "$file_with_new_extension""
  mv "$current_filename" "$file_with_new_extension"
  echo "        Success! Renaming current filename to:  "$file_with_new_extension""
}
# recersively list files and subtitles
list_files() {
  local dir="$1"
  echo "  Searching directory: $dir"
  # loop through files in path
  for item in "$dir"/*; do
    # check if current item is a file
    if [ -f "$item" ]; then
      # print its path
      echo "    Checking file "$item""
    # check if current item is a directory
    elif [ -d "$item" ]; then
      # rinse and repeat
      echo "    Directory found "$item""
      list_files "$item"
    fi
  done
}
# # recersively rename files and subfiles
rename_files() {
  local dir="$1"
  echo "  Searching directory: $dir"
  # loop through files in path
  for dir_path in "$dir"/*; do
    # check if current dir_path is a file
    if [ -f "$dir_path" ]; then
      # check if file path contains the pattern
      if echo "$dir_path" | grep -q "\<$pattern\>"; then
        echo "    File has ."$pattern" extension "
        rename_file $dir_path
      else
        echo "    File does not have ."$pattern" extension. So it will be left alone."
      fi
    # check if current dir_path is a directory
    elif [ -d "$dir_path" ]; then
      # rinse and repeat
      echo "    Directory found "$dir_path""
      rename_files "$dir_path"
    fi
  done
}

# error handling first
require_path ""
require_new_name ""
require_pattern ""
rename_files "$path"
# count_files_matching_criteria ""
