import type { NextFunction, Request, Response } from "express";

/**
 * Express 4 does not forward a rejected promise from an `async` route
 * handler to the error middleware on its own (that's an Express 5
 * behavior) — without this, a thrown/rejected error here just hangs the
 * request instead of producing a 500. Wrap every async handler with this.
 */
export function asyncHandler<Req extends Request = Request>(
  fn: (req: Req, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Req, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
