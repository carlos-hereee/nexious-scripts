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
