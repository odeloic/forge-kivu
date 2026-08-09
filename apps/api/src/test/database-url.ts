const DEFAULT_DATABASE_URL = 'postgres://forge:forge@localhost:5440/forge_kivu'

export const testDatabaseUrl = (): string => {
  const url = new URL(process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL)
  url.pathname = `${url.pathname}_test`
  return url.toString()
}
