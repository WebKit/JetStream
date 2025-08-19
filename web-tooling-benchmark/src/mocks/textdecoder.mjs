// Basic TextDecoder mock implementation
export class TextDecoder {
  constructor(encoding = "utf-8") {
    // For simplicity, this mock only supports utf-8
    if (encoding.toLowerCase() !== "utf-8") {
      throw new Error(`Encoding not supported: ${encoding}`);
    }
  }

  decode(buffer) {
    let string = "";
    let i = 0;
    while (i < buffer.length) {
      let byte = buffer[i];
      if (byte < 0x80) {
        string += String.fromCharCode(byte);
        i++;
      } else if (byte >= 0xc2 && byte < 0xe0) {
        string += String.fromCharCode(
          ((byte & 0x1f) << 6) | (buffer[i + 1] & 0x3f)
        );
        i += 2;
      } else if (byte >= 0xe0 && byte < 0xf0) {
        string += String.fromCharCode(
          ((byte & 0x0f) << 12) |
            ((buffer[i + 1] & 0x3f) << 6) |
            (buffer[i + 2] & 0x3f)
        );
        i += 3;
      } else {
        // For simplicity, handling of 4-byte characters and surrogates is omitted
        i++;
      }
    }
    return string;
  }
}
