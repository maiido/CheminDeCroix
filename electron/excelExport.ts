import ExcelJS from 'exceljs'
import type { Child, Attendance } from './database'

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function timeToExcel(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h * 60 + m) / (24 * 60)
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h${String(m).padStart(2, '0')}`
}

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export async function exportToExcel(
  filePath: string,
  children: Child[],
  attendance: Attendance[],
  year: number,
  month: number
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'CheminDeCroix'
  workbook.created = new Date()

  const monthName = `${MONTH_NAMES[month]} ${year}`

  // Build attendance map: { childId: { dateStr: { arrival, departure } } }
  const attMap = new Map<number, Map<string, Attendance>>()
  for (const a of attendance) {
    if (!attMap.has(a.child_id)) attMap.set(a.child_id, new Map())
    attMap.get(a.child_id)!.set(a.date, a)
  }

  // Get all days in the month
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days: number[] = []
  for (let d = 1; d <= daysInMonth; d++) days.push(d)

  // === Onglets par enfant (créés en premier pour pouvoir les référencer) ===
  const childSheetRefs: { sheetName: string; totalCell: string; dataStartRow: number; dataEndRow: number }[] = []

  for (const child of children) {
    const sheetName = `${child.first_name} ${child.last_name}`.substring(0, 31)
    const sheet = workbook.addWorksheet(sheetName)

    // Title
    sheet.mergeCells(1, 1, 1, 5)
    sheet.getCell(1, 1).value = `${child.first_name} ${child.last_name} — ${monthName}`
    sheet.getCell(1, 1).font = { bold: true, size: 14 }
    sheet.getCell(1, 1).alignment = { horizontal: 'center' }

    // Headers
    const hdr = sheet.getRow(3)
    hdr.getCell(1).value = 'Date'
    hdr.getCell(2).value = 'Jour'
    hdr.getCell(3).value = 'Arrivée'
    hdr.getCell(4).value = 'Départ'
    hdr.getCell(5).value = 'Durée'
    for (let c = 1; c <= 5; c++) {
      hdr.getCell(c).font = { bold: true }
      hdr.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
      hdr.getCell(c).border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' }
      }
      hdr.getCell(c).alignment = { horizontal: 'center' }
    }

    const childAtt = attMap.get(child.id)
    let r = 4

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const date = new Date(year, month, d)
      const dow = (date.getDay() + 6) % 7
      const dayName = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'][dow]

      const att = childAtt?.get(dateStr)
      if (att) {
        const row = sheet.getRow(r)
        row.getCell(1).value = `${String(d).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}`
        row.getCell(2).value = dayName
        if (att.arrival_time === 'absent') {
          row.getCell(3).value = 'Absent'
          row.getCell(4).value = 'Absent'
          row.getCell(5).value = 0
        } else {
          row.getCell(3).value = timeToExcel(att.arrival_time)
          row.getCell(3).numFmt = 'hh:mm'
          row.getCell(4).value = timeToExcel(att.departure_time)
          row.getCell(4).numFmt = 'hh:mm'
          row.getCell(5).value = { formula: `D${r}-C${r}` }
          row.getCell(5).numFmt = '[h]:mm'
        }

        for (let c = 1; c <= 5; c++) {
          row.getCell(c).border = {
            top: { style: 'thin' }, bottom: { style: 'thin' },
            left: { style: 'thin' }, right: { style: 'thin' }
          }
          row.getCell(c).alignment = { horizontal: 'center' }
        }
        r++
      }
    }

    const dataEndRow = r - 1

    // Total row
    const totalRow = sheet.getRow(r)
    totalRow.getCell(4).value = 'Total:'
    totalRow.getCell(4).font = { bold: true }
    totalRow.getCell(4).alignment = { horizontal: 'right' }
    if (r > 4) {
      totalRow.getCell(5).value = { formula: `SUM(E4:E${dataEndRow})` }
    } else {
      totalRow.getCell(5).value = 0
    }
    totalRow.getCell(5).numFmt = '[h]:mm'
    totalRow.getCell(5).font = { bold: true }
    totalRow.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
    totalRow.getCell(5).alignment = { horizontal: 'center' }

    sheet.getColumn(1).width = 12
    sheet.getColumn(2).width = 12
    sheet.getColumn(3).width = 10
    sheet.getColumn(4).width = 10
    sheet.getColumn(5).width = 10

    sheet.views = [{ state: 'frozen', ySplit: 3 }]

    childSheetRefs.push({
      sheetName: `'${sheetName}'`,
      totalCell: `E${r}`,
      dataStartRow: 4,
      dataEndRow,
    })
  }

  // === Onglet Récap (avec formules vers les onglets enfants) ===
  const recapSheet = workbook.addWorksheet(`Récap ${MONTH_NAMES[month]}`)

  // Title row
  recapSheet.mergeCells(1, 1, 1, 4)
  recapSheet.getCell(1, 1).value = `CheminDeCroix — Récapitulatif ${monthName}`
  recapSheet.getCell(1, 1).font = { bold: true, size: 14 }
  recapSheet.getCell(1, 1).alignment = { horizontal: 'center' }

  // Header row
  const headerRow = recapSheet.getRow(3)
  headerRow.getCell(1).value = 'Nom'
  headerRow.getCell(2).value = 'Prénom'
  headerRow.getCell(3).value = 'Total heures'
  headerRow.getCell(4).value = 'Jours présents'
  for (let c = 1; c <= 4; c++) {
    headerRow.getCell(c).font = { bold: true }
    headerRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
    headerRow.getCell(c).border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' }
    }
    headerRow.getCell(c).alignment = { horizontal: 'center' }
  }

  // Data rows with formulas referencing child sheets
  let rowIdx = 4
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const ref = childSheetRefs[i]
    const row = recapSheet.getRow(rowIdx)
    row.getCell(1).value = child.last_name
    row.getCell(2).value = child.first_name

    if (ref && ref.dataEndRow >= ref.dataStartRow) {
      row.getCell(3).value = { formula: `=${ref.sheetName}!${ref.totalCell}` }
      row.getCell(4).value = { formula: `=COUNT(${ref.sheetName}!E${ref.dataStartRow}:E${ref.dataEndRow})` }
    } else {
      row.getCell(3).value = 0
      row.getCell(4).value = 0
    }
    row.getCell(3).numFmt = '[h]:mm'
    row.getCell(3).alignment = { horizontal: 'center' }
    row.getCell(3).font = { bold: true }
    row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }

    row.getCell(4).alignment = { horizontal: 'center' }

    for (let c = 1; c <= 4; c++) {
      row.getCell(c).border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' }
      }
    }

    rowIdx++
  }

  // Grand total row
  const grandTotalRow = recapSheet.getRow(rowIdx)
  grandTotalRow.getCell(2).value = 'Total général :'
  grandTotalRow.getCell(2).font = { bold: true }
  grandTotalRow.getCell(2).alignment = { horizontal: 'right' }
  if (rowIdx > 4) {
    grandTotalRow.getCell(3).value = { formula: `SUM(C4:C${rowIdx - 1})` }
    grandTotalRow.getCell(4).value = { formula: `SUM(D4:D${rowIdx - 1})` }
  } else {
    grandTotalRow.getCell(3).value = 0
    grandTotalRow.getCell(4).value = 0
  }
  grandTotalRow.getCell(3).numFmt = '[h]:mm'
  grandTotalRow.getCell(3).font = { bold: true, size: 12 }
  grandTotalRow.getCell(3).alignment = { horizontal: 'center' }
  grandTotalRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } }
  for (let c = 1; c <= 4; c++) {
    grandTotalRow.getCell(c).border = {
      top: { style: 'double' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' }
    }
  }

  // Column widths
  recapSheet.getColumn(1).width = 20
  recapSheet.getColumn(2).width = 20
  recapSheet.getColumn(3).width = 15
  recapSheet.getColumn(4).width = 15

  // Freeze panes
  recapSheet.views = [{ state: 'frozen', ySplit: 3 }]

  await workbook.xlsx.writeFile(filePath)
}

export async function exportYearToExcel(
  filePath: string,
  children: Child[],
  attendance: Attendance[],
  year: number
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'CheminDeCroix'
  workbook.created = new Date()

  // Build attendance map: { childId: { dateStr: Attendance } }
  const attMap = new Map<number, Map<string, Attendance>>()
  for (const a of attendance) {
    if (!attMap.has(a.child_id)) attMap.set(a.child_id, new Map())
    attMap.get(a.child_id)!.set(a.date, a)
  }

  // === Onglets par enfant (créés en premier pour pouvoir les référencer) ===
  const childSheetRefs: { sheetName: string; dataStartRow: number; dataEndRow: number; totalCell: string }[] = []

  for (const child of children) {
    const sheetName = `${child.first_name} ${child.last_name}`.substring(0, 31)
    const sheet = workbook.addWorksheet(sheetName)

    // Title
    sheet.mergeCells(1, 1, 1, 6)
    sheet.getCell(1, 1).value = `${child.first_name} ${child.last_name} — ${year}`
    sheet.getCell(1, 1).font = { bold: true, size: 14 }
    sheet.getCell(1, 1).alignment = { horizontal: 'center' }

    // Headers
    const hdr = sheet.getRow(3)
    hdr.getCell(1).value = 'Date'
    hdr.getCell(2).value = 'Jour'
    hdr.getCell(3).value = 'Arrivée'
    hdr.getCell(4).value = 'Départ'
    hdr.getCell(5).value = 'Durée'
    hdr.getCell(6).value = 'Mois'
    for (let c = 1; c <= 6; c++) {
      hdr.getCell(c).font = { bold: true }
      hdr.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
      hdr.getCell(c).border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' }
      }
      hdr.getCell(c).alignment = { horizontal: 'center' }
    }

    const childAtt = attMap.get(child.id)
    let r = 4

    for (let m = 0; m < 12; m++) {
      const daysInMonth = new Date(year, m + 1, 0).getDate()
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        const date = new Date(year, m, d)
        const dow = (date.getDay() + 6) % 7
        const dayName = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'][dow]

        const att = childAtt?.get(dateStr)
        if (att) {
          const row = sheet.getRow(r)
          row.getCell(1).value = `${String(d).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}`
          row.getCell(2).value = dayName
          if (att.arrival_time === 'absent') {
            row.getCell(3).value = 'Absent'
            row.getCell(4).value = 'Absent'
            row.getCell(5).value = 0
          } else {
            row.getCell(3).value = timeToExcel(att.arrival_time)
            row.getCell(3).numFmt = 'hh:mm'
            row.getCell(4).value = timeToExcel(att.departure_time)
            row.getCell(4).numFmt = 'hh:mm'
            row.getCell(5).value = { formula: `D${r}-C${r}` }
            row.getCell(5).numFmt = '[h]:mm'
          }
          row.getCell(6).value = MONTH_NAMES[m]

          for (let c = 1; c <= 6; c++) {
            row.getCell(c).border = {
              top: { style: 'thin' }, bottom: { style: 'thin' },
              left: { style: 'thin' }, right: { style: 'thin' }
            }
            row.getCell(c).alignment = { horizontal: 'center' }
          }
          r++
        }
      }
    }

    const dataEndRow = r - 1

    // Total row
    const totalRow = sheet.getRow(r)
    totalRow.getCell(5).value = 'Total:'
    totalRow.getCell(5).font = { bold: true }
    totalRow.getCell(5).alignment = { horizontal: 'right' }
    if (r > 4) {
      totalRow.getCell(6).value = { formula: `SUM(E4:E${dataEndRow})` }
    } else {
      totalRow.getCell(6).value = 0
    }
    totalRow.getCell(6).numFmt = '[h]:mm'
    totalRow.getCell(6).font = { bold: true }
    totalRow.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
    totalRow.getCell(6).alignment = { horizontal: 'center' }

    sheet.getColumn(1).width = 12
    sheet.getColumn(2).width = 12
    sheet.getColumn(3).width = 10
    sheet.getColumn(4).width = 10
    sheet.getColumn(5).width = 10
    sheet.getColumn(6).width = 12

    sheet.views = [{ state: 'frozen', ySplit: 3 }]

    childSheetRefs.push({
      sheetName: `'${sheetName}'`,
      dataStartRow: 4,
      dataEndRow,
      totalCell: `F${r}`,
    })
  }

  // === Onglet Récap annuel (avec formules vers les onglets enfants) ===
  const recapSheet = workbook.addWorksheet(`Récap ${year}`)

  // Title row
  recapSheet.mergeCells(1, 1, 1, 15)
  recapSheet.getCell(1, 1).value = `CheminDeCroix — Récapitulatif annuel ${year}`
  recapSheet.getCell(1, 1).font = { bold: true, size: 14 }
  recapSheet.getCell(1, 1).alignment = { horizontal: 'center' }

  // Header row
  const headerRow = recapSheet.getRow(3)
  headerRow.getCell(1).value = 'Nom'
  headerRow.getCell(2).value = 'Prénom'
  for (let m = 0; m < 12; m++) {
    headerRow.getCell(3 + m).value = MONTH_NAMES[m].substring(0, 4)
  }
  headerRow.getCell(15).value = 'Total'
  for (let c = 1; c <= 15; c++) {
    headerRow.getCell(c).font = { bold: true }
    headerRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
    headerRow.getCell(c).border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' }
    }
    headerRow.getCell(c).alignment = { horizontal: 'center' }
  }

  // Data rows with SUMIF formulas referencing child sheets
  let rowIdx = 4
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const ref = childSheetRefs[i]
    const row = recapSheet.getRow(rowIdx)
    row.getCell(1).value = child.last_name
    row.getCell(2).value = child.first_name

    if (ref && ref.dataEndRow >= ref.dataStartRow) {
      for (let m = 0; m < 12; m++) {
        const col = 3 + m
        const colLetter = String.fromCharCode(67 + m) // C, D, E, ... N
        row.getCell(col).value = {
          formula: `SUMIF(${ref.sheetName}!F${ref.dataStartRow}:F${ref.dataEndRow},"${MONTH_NAMES[m]}",${ref.sheetName}!E${ref.dataStartRow}:E${ref.dataEndRow})`
        }
        row.getCell(col).numFmt = '[h]:mm'
        row.getCell(col).alignment = { horizontal: 'center' }
      }
      row.getCell(15).value = { formula: `=${ref.sheetName}!${ref.totalCell}` }
    } else {
      for (let m = 0; m < 12; m++) {
        row.getCell(3 + m).value = ''
      }
      row.getCell(15).value = 0
    }
    row.getCell(15).numFmt = '[h]:mm'
    row.getCell(15).font = { bold: true }
    row.getCell(15).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
    row.getCell(15).alignment = { horizontal: 'center' }

    for (let c = 1; c <= 15; c++) {
      row.getCell(c).border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' }
      }
    }

    rowIdx++
  }

  // Grand total row
  const grandTotalRow = recapSheet.getRow(rowIdx)
  grandTotalRow.getCell(2).value = 'Total général :'
  grandTotalRow.getCell(2).font = { bold: true }
  grandTotalRow.getCell(2).alignment = { horizontal: 'right' }
  if (rowIdx > 4) {
    for (let m = 0; m < 12; m++) {
      const col = 3 + m
      const colLetter = String.fromCharCode(67 + m)
      grandTotalRow.getCell(col).value = { formula: `SUM(${colLetter}4:${colLetter}${rowIdx - 1})` }
      grandTotalRow.getCell(col).numFmt = '[h]:mm'
    }
    grandTotalRow.getCell(15).value = { formula: `SUM(O4:O${rowIdx - 1})` }
  } else {
    grandTotalRow.getCell(15).value = 0
  }
  grandTotalRow.getCell(15).numFmt = '[h]:mm'
  grandTotalRow.getCell(15).font = { bold: true, size: 12 }
  grandTotalRow.getCell(15).alignment = { horizontal: 'center' }
  grandTotalRow.getCell(15).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } }
  for (let c = 1; c <= 15; c++) {
    grandTotalRow.getCell(c).border = {
      top: { style: 'double' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' }
    }
  }

  // Column widths
  recapSheet.getColumn(1).width = 20
  recapSheet.getColumn(2).width = 20
  for (let c = 3; c <= 14; c++) recapSheet.getColumn(c).width = 8
  recapSheet.getColumn(15).width = 12

  recapSheet.views = [{ state: 'frozen', ySplit: 3, xSplit: 2 }]

  await workbook.xlsx.writeFile(filePath)
}
