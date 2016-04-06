export function initShared (args, options, next) {
  const shared = { };
  next(args, options, shared);
}
