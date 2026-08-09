export type Mail = {
  to: string
  subject: string
  text: string
}

export const outbox: Mail[] = []

export const sendMail = async (mail: Mail): Promise<void> => {
  outbox.push(mail)
  console.log(`[mail] to=${mail.to} subject=${mail.subject}\n${mail.text}`)
}
