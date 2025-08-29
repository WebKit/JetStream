import zlib
import argparse
import sys
import os

def compress_file(input_path, output_path, remove_input=False):
    """Compress a file using zlib compression."""
    try:
        # Read input file in binary mode
        with open(input_path, 'rb') as input_file:
            data = input_file.read()
        
        # Compress the data
        compressed_data = zlib.compress(data)
        
        # Write compressed data to output file
        with open(output_path, 'wb') as output_file:
            output_file.write(compressed_data)
        
        # Print compression statistics
        original_size = len(data)
        compressed_size = len(compressed_data)
        compression_ratio = (1 - compressed_size / original_size) * 100
        
        print(f"Compression complete!")
        print(f"Original size: {original_size} bytes")
        print(f"Compressed size: {compressed_size} bytes")
        print(f"Compression ratio: {compression_ratio:.2f}%")
        
        # Remove input file if requested
        if remove_input:
            os.remove(input_path)
            print(f"Input file '{input_path}' deleted.")
        
    except FileNotFoundError:
        print(f"Error: Input file '{input_path}' not found.", file=sys.stderr)
        sys.exit(1)
    except PermissionError:
        print(f"Error: Permission denied accessing files.", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Compress a file using zlib compression")
    parser.add_argument("input_file", help="Path to the input file to compress")
    parser.add_argument("output_file", nargs='?', help="Path to the output compressed file (default: input_file + '.z')")
    parser.add_argument("--rm", action="store_true", help="Remove input file after successful compression")
    
    args = parser.parse_args()
    
    # Check if input file exists
    if not os.path.exists(args.input_file):
        print(f"Error: Input file '{args.input_file}' does not exist.", file=sys.stderr)
        sys.exit(1)
    
    # Generate output filename if not provided
    output_file = args.output_file if args.output_file else args.input_file + '.z'
    
    compress_file(args.input_file, output_file, args.rm)

if __name__ == "__main__":
    main()
