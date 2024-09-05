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
