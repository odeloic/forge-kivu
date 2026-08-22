const DEFAULT_S3_BUCKET = 'forge-kivu'

export const testBucket = (): string =>
  `${process.env.S3_BUCKET ?? DEFAULT_S3_BUCKET}-test`
