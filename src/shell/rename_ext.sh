#!/bin/bash
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

source helpers/require_path.sh
source helpers/require_pattern.sh

#!/bin/bash
rename_file() {
  local current="$1"
  # # remove string from the original string if exists
  local clip_filename_extension="${current//${pattern}/}"
  local file_with_new_extension="$clip_filename_extension"""$newName""
  mv "$current" "$file_with_new_extension"
  tabs 4
  echo -e "Success! Renaming current filename to:  "$file_with_new_extension""
}

# # recersively rename files and subfiles
rename_files() {
  local dir="$1"
  echo -e "Searching directory: $dir"
  # loop through files in path
  for dir_path in "$dir"/*; do
    # check if current dir_path is a file
    if [ -f "$dir_path" ]; then
      # check if file path contains the pattern
      if echo -e "$dir_path" | grep -q "\<$pattern\>"; then
        echo -e "File has ."$pattern" extension "
        rename_file $dir_path
      else
        echo -e "File does not have ."$pattern" extension. So it will be left alone."
      fi
    # check if current dir_path is a directory
    elif [ -d "$dir_path" ]; then
      # rinse and repeat
      echo -e "Directory found "$dir_path""
      rename_files "$dir_path"
    fi
  done
}

# error handling first
require_path ""
require_pattern ""
rename_files "$path"
