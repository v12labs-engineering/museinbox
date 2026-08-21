declare module "facebook-nodejs-business-sdk" {
  export class FacebookAdsApi {
    constructor(accessToken: string, locale?: string, crashLog?: boolean);
    call(
      method: string,
      path: string | string[],
      params?: Record<string, unknown>,
      files?: Record<string, unknown>,
      useMultipartFormData?: boolean,
      urlOverride?: string,
    ): Promise<unknown>;
  }
}
