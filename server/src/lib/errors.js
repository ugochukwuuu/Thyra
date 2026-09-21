/** An error that is safe to show to the client. */
export class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   * @param {{ fields?: Record<string,string>, extra?: object }} [details]
   */
  constructor(status, message, details = {}) {
    super(message);
    this.status = status;
    this.fields = details.fields;
    this.extra = details.extra;
  }
}
