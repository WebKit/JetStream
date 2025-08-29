import zlib
import argparse
import sys
import os
import glob

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

def decompress_file(input_path, output_path, remove_input=False):
    """Decompress a file using zlib decompression."""
    try:
        # Read compressed file in binary mode
        with open(input_path, 'rb') as input_file:
            compressed_data = input_file.read()
        
        # Decompress the data
        data = zlib.decompress(compressed_data)
        
        # Write decompressed data to output file
        with open(output_path, 'wb') as output_file:
            output_file.write(data)
        
        # Print decompression statistics
        compressed_size = len(compressed_data)
        decompressed_size = len(data)
        expansion_ratio = (decompressed_size / compressed_size - 1) * 100
        
        print(f"Decompression complete!")
        print(f"Compressed size: {compressed_size} bytes")
        print(f"Decompressed size: {decompressed_size} bytes")
        print(f"Expansion ratio: {expansion_ratio:.2f}%")
        
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
    except zlib.error:
        print(f"Error: Invalid or corrupted compressed data in '{input_path}'.", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

def find_wasm_files(directory="."):
    """Find all .wasm files in directory and subdirectories."""
    # Find all .wasm files recursively
    pattern = os.path.join(directory, "**", "*.wasm")
    wasm_files = glob.glob(pattern, recursive=True)
    
    return wasm_files

def find_z_files(directory="."):
    """Find all .z files in directory and subdirectories."""
    # Find all .z files recursively
    pattern = os.path.join(directory, "**", "*.z")
    z_files = glob.glob(pattern, recursive=True)
    
    return z_files

def decompress_files(z_files, remove_input=False):
    """Decompress all .z files from the provided list."""
    if not z_files:
        print("No .z files provided to decompress.")
        return
    
    print(f"Found {len(z_files)} .z file(s) to decompress:")
    
    for z_file in z_files:
        # Create output filename by removing .z extension
        output_file = z_file[:-2]  # Remove last 2 characters (.z)
        
        print(f"\nDecompressing: {z_file} -> {output_file}")
        
        try:
            decompress_file(z_file, output_file, remove_input)
        except SystemExit:
            # Continue with next file if one fails
            print(f"Failed to decompress {z_file}, continuing with next file...")
            continue
    
    print(f"\nBatch decompression complete!")

def compress_files(files, remove_input=True):
    """Compress all files from the provided list."""
    if not files:
        print("No files provided to compress.")
        return
    
    print(f"Found {len(files)} file(s) to compress:")
    
    for file_path in files:
        # Create output filename by adding .z extension
        output_file = file_path + ".z"
        
        print(f"\nCompressing: {file_path} -> {output_file}")
        
        try:
            compress_file(file_path, output_file, remove_input)
        except SystemExit:
            # Continue with next file if one fails
            print(f"Failed to compress {file_path}, continuing with next file...")
            continue
    
    print(f"\nBatch compression complete!")

def main():
    """Main function to handle command-line arguments and batch operations."""
    parser = argparse.ArgumentParser(description="Compress or decompress files using zlib.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('-c', '--compress', action='store_true', 
                      help='Compress all .wasm files in current directory and subdirectories')
    group.add_argument('-d', '--decompress', action='store_true',
                      help='Decompress all .z files in current directory and subdirectories')
    parser.add_argument('--keep-input', action='store_true',
                       help='Keep input files after processing (default: remove input files)')
    parser.add_argument('--directory', default='.',
                       help='Directory to search for files (default: current directory)')
    
    args = parser.parse_args()
    
    # Determine whether to remove input files (opposite of keep_input)
    remove_input = not args.keep_input
    
    if args.compress:
        # Find and compress all .wasm files
        wasm_files = find_wasm_files(args.directory)
        compress_files(wasm_files, remove_input)
    elif args.decompress:
        # Find and decompress all .z files
        z_files = find_z_files(args.directory)
        decompress_files(z_files, remove_input)

if __name__ == "__main__":
    main()



