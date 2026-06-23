/**
 * Gerador de Pix BR Code (EMV QR Code do BACEN).
 *
 * Especificação resumida — campos TLV (tag-length-value) concatenados,
 * cada campo é `TT-LL-VV` onde TT é o ID, LL é o tamanho zero-padded,
 * VV é o valor. CRC16-CCITT no final fecha o payload.
 *
 * Campos usados:
 *  - 00 Payload Format Indicator = "01"
 *  - 26 Merchant Account Info → 00 (BR.GOV.BCB.PIX) + 01 (chave)
 *  - 52 Merchant Category Code   = "0000"
 *  - 53 Currency                  = "986" (BRL)
 *  - 54 Amount                    = valor formatado "0.00"
 *  - 58 Country                   = "BR"
 *  - 59 Merchant Name             = nome (máx 25)
 *  - 60 Merchant City             = cidade (máx 15)
 *  - 62 Additional Data → 05 (txid)
 *  - 63 CRC16
 *
 * Referência: Manual de Padrões do Pix (BACEN).
 */

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0")
  return `${id}${len}${value}`
}

/**
 * CRC16-CCITT (polinômio 0x1021, init 0xFFFF). O Pix exige esse algoritmo
 * sobre o payload com o sufixo "6304" já presente (placeholder do CRC).
 */
function crc16ccitt(input: string): string {
  let crc = 0xffff
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0")
}

/**
 * Normaliza string removendo acentos + caracteres não-ASCII e cortando
 * num tamanho máximo. O EMV é estrito quanto a charset.
 */
function clean(s: string, max: number): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .slice(0, max)
}

export type PixBRCodeInput = {
  /** Chave PIX (CNPJ só dígitos, e-mail, telefone +55..., ou UUID). */
  chave: string
  /** Nome do recebedor — máx 25 caracteres ASCII. */
  nome: string
  /** Cidade do recebedor — máx 15 caracteres ASCII. */
  cidade: string
  /** Valor em reais (ex.: 350.50). 0 ou undefined gera QR sem valor. */
  valor?: number
  /** Identificador da transação (até 25 chars alfanuméricos). */
  txid?: string
}

/**
 * Constrói a string BR Code do Pix conforme EMV / BACEN. O retorno
 * pode ser usado direto em libs de QR (gerar imagem/svg) ou copiado
 * como "Pix copia e cola".
 */
export function gerarPixBRCode(input: PixBRCodeInput): string {
  const merchantAccountInfo =
    tlv("00", "BR.GOV.BCB.PIX") + tlv("01", input.chave)

  const additionalData = tlv("05", clean(input.txid ?? "***", 25))

  // Monta o payload sem o CRC (ainda) — usamos "6304" como sufixo
  // placeholder antes de calcular o CRC, conforme spec.
  const partes: string[] = [
    tlv("00", "01"),
    tlv("26", merchantAccountInfo),
    tlv("52", "0000"),
    tlv("53", "986"),
  ]
  if (input.valor && input.valor > 0) {
    partes.push(tlv("54", input.valor.toFixed(2)))
  }
  partes.push(tlv("58", "BR"))
  partes.push(tlv("59", clean(input.nome, 25)))
  partes.push(tlv("60", clean(input.cidade, 15)))
  partes.push(tlv("62", additionalData))

  const semCrc = partes.join("") + "6304"
  const crc = crc16ccitt(semCrc)
  return semCrc + crc
}
