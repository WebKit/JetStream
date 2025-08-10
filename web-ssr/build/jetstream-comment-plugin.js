
module.exports = function({ types: t }) {
  return {
    visitor: {
      Function(path) {
        // Add an inner comment to each function that can be replaced
        // to prevent code caching.
        const body = path.get("body");
         body.addComment("leading", "ThouShaltNotCache");
      },
    },
  };
};