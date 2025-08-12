
exports.TextEncoder = class TextEncoder {
  encode(str) {
    const arr = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      arr[i] = str.charCodeAt(i);
    }
    return arr;
  }
};

exports.TextDecoder = class TextDecoder {
  decode(arr) {
    let str = '';
    for (let i = 0; i < arr.length; i++) {
      str += String.fromCharCode(arr[i]);
    }
    return str;
  }
};
