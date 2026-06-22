/**
 * reports.js – Export to Excel (SheetJS) and PDF (jsPDF)
 */

const REPORTS = (() => {

  // ---- Shared helpers ----
  function getStatusLabel(status) {
    return ENGINE.STATUS_LABELS[status] || status;
  }

  function formatDate(d) { return NORMALIZER.formatDateBR(d); }
  function formatVal(v)  { return v !== null ? NORMALIZER.formatCurrency(v) : '—'; }

  // ---- Excel Export ----
  function exportExcel(results, summary, filename = 'conciliacao') {
    const wb = XLSX.utils.book_new();

    // --- Sheet 1: Results ---
    const resultRows = results.map((r, i) => ({
      '#': i + 1,
      'Status':             getStatusLabel(r.status),
      'Data Banco':         formatDate(r.bankRow?.date),
      'Valor Banco':        r.bankRow?.value ?? '',
      'Descrição Banco':    r.bankRow?.desc || '',
      'Ref. Banco':         r.bankRow?.ref || '',
      'Data Sistema':       formatDate(r.systemRow?.date),
      'Valor Sistema':      r.systemRow?.value ?? '',
      'Descrição Sistema':  r.systemRow?.desc || '',
      'Ref. Sistema':       r.systemRow?.ref || '',
      'Observação':         r.note || '',
    }));

    const ws1 = XLSX.utils.json_to_sheet(resultRows);

    // Column widths
    ws1['!cols'] = [
      { wch: 4 }, { wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 35 }, { wch: 12 },
      { wch: 12 }, { wch: 14 }, { wch: 35 }, { wch: 12 }, { wch: 30 },
    ];

    XLSX.utils.book_append_sheet(wb, ws1, 'Conciliação Detalhada');

    // --- Sheet 2: Summary ---
    const summaryRows = [
      ['RESUMO DA CONCILIAÇÃO', ''],
      ['Gerado em', new Date().toLocaleString('pt-BR')],
      ['', ''],
      ['Total de Registros', summary.total],
      ['Conciliado (Exato)', summary.conciliado],
      ['Conciliado (Divergência de Data)', summary.conciliadoData],
      ['Provável Correspondência', summary.provavelCorrespondencia],
      ['Divergência de Valor', summary.divergenciaValor],
      ['Não Registrado no Sistema', summary.naoRegistrado],
      ['Não Compensado no Banco', summary.naoCompensado],
      ['Duplicidades', summary.duplicidade],
      ['', ''],
      ['Percentual Conciliado', summary.percentual + '%'],
      ['Valor Conciliado', formatVal(summary.valorConciliado)],
      ['Valor Pendente', formatVal(summary.valorPendente)],
    ];

    const ws2 = XLSX.utils.aoa_to_sheet(summaryRows);
    ws2['!cols'] = [{ wch: 40 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumo');

    // --- Sheet 3: Bank Data ---
    const bankRows = results
      .filter(r => r.bankRow)
      .map(r => ({
        'Data':      formatDate(r.bankRow.date),
        'Valor':     r.bankRow.value,
        'Descrição': r.bankRow.desc,
        'Referência':r.bankRow.ref,
        'Status':    getStatusLabel(r.status),
      }));
    const ws3 = XLSX.utils.json_to_sheet(bankRows);
    ws3['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 40 }, { wch: 15 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Extrato Bancário');

    // --- Sheet 4: System Data ---
    const sysRows = results
      .filter(r => r.systemRow)
      .map(r => ({
        'Data':      formatDate(r.systemRow.date),
        'Valor':     r.systemRow.value,
        'Descrição': r.systemRow.desc,
        'Referência':r.systemRow.ref,
        'Status':    getStatusLabel(r.status),
      }));
    const ws4 = XLSX.utils.json_to_sheet(sysRows);
    ws4['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 40 }, { wch: 15 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws4, 'Relatório Sistema');

    // Save
    const ts = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${filename}_${ts}.xlsx`);
    AUDIT.log('export_excel', `Relatório Excel exportado: ${filename}_${ts}.xlsx`);
  }

  // ---- PDF Export ----
  function exportPDF(results, summary, filename = 'conciliacao') {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const PAGE_W = doc.internal.pageSize.getWidth();
    const MARGIN = 15;

    // ---- Header ----
    doc.setFillColor(6, 13, 26);
    doc.rect(0, 0, PAGE_W, 28, 'F');

    doc.setFillColor(29, 78, 216);
    doc.rect(0, 0, 4, 28, 'F');

    doc.setTextColor(241, 245, 249);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO DE CONCILIAÇÃO BANCÁRIA', MARGIN + 4, 12);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, MARGIN + 4, 20);
    doc.text(`Sistema de Conciliação Bancária v1.0`, PAGE_W - MARGIN, 20, { align: 'right' });

    // ---- Summary Boxes ----
    let yPos = 36;
    const boxW = (PAGE_W - MARGIN * 2 - 20) / 6;
    const boxes = [
      { label: 'Total',         value: summary.total,                    color: [59, 130, 246] },
      { label: 'Conciliado',    value: summary.conciliado + summary.conciliadoData, color: [16, 185, 129] },
      { label: 'Divergente',    value: summary.divergenciaValor,         color: [249, 115, 22] },
      { label: 'Não Reg.',      value: summary.naoRegistrado,            color: [239, 68, 68]  },
      { label: 'Não Comp.',     value: summary.naoCompensado,            color: [139, 92, 246] },
      { label: '% Conciliado',  value: summary.percentual + '%',         color: [6, 182, 212]  },
    ];

    boxes.forEach((box, i) => {
      const x = MARGIN + i * (boxW + 4);
      doc.setFillColor(13, 24, 41);
      doc.roundedRect(x, yPos, boxW, 18, 2, 2, 'F');
      doc.setFillColor(...box.color);
      doc.rect(x, yPos, 2, 18, 'F');

      doc.setTextColor(...box.color);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(String(box.value), x + 5, yPos + 10);

      doc.setTextColor(148, 163, 184);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text(box.label, x + 5, yPos + 15);
    });

    // ---- Main Table ----
    yPos = 62;
    const statusColors = {
      CONCILIADO:      [16, 185, 129],
      CONCILIADO_DATA: [245, 158, 11],
      PROVAVEL:        [59, 130, 246],
      DIV_VALOR:       [249, 115, 22],
      NAO_REGISTRADO:  [239, 68, 68],
      NAO_COMPENSADO:  [139, 92, 246],
      DUPLICIDADE:     [244, 114, 182],
    };

    const tableData = results.slice(0, 80).map(r => [
      formatDate(r.bankRow?.date  || r.systemRow?.date),
      formatVal(r.bankRow?.value),
      (r.bankRow?.desc || '').slice(0, 35),
      formatDate(r.systemRow?.date),
      formatVal(r.systemRow?.value),
      (r.systemRow?.desc || '').slice(0, 35),
      getStatusLabel(r.status),
    ]);

    doc.autoTable({
      startY: yPos,
      head: [['Data Banco', 'Valor Banco', 'Desc. Banco', 'Data Sistema', 'Valor Sistema', 'Desc. Sistema', 'Status']],
      body: tableData,
      margin: { left: MARGIN, right: MARGIN },
      headStyles: {
        fillColor: [13, 24, 41],
        textColor: [148, 163, 184],
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: 4,
      },
      bodyStyles: {
        fillColor: [11, 19, 32],
        textColor: [241, 245, 249],
        fontSize: 7,
        cellPadding: 3.5,
      },
      alternateRowStyles: { fillColor: [13, 24, 41] },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 22, halign: 'right' },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 18 },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 'auto' },
        6: { cellWidth: 40 },
      },
      didDrawCell: (data) => {
        if (data.column.index === 6 && data.section === 'body') {
          const result = results[data.row.index];
          if (result) {
            const col = statusColors[result.status] || [148, 163, 184];
            doc.setTextColor(...col);
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'bold');
            doc.text(
              getStatusLabel(result.status),
              data.cell.x + 2,
              data.cell.y + data.cell.height / 2 + 1
            );
            return false; // prevent default text rendering
          }
        }
      },
      didDrawPage: (data) => {
        // Footer
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFillColor(6, 13, 26);
        doc.rect(0, pageH - 10, PAGE_W, 10, 'F');
        doc.setTextColor(71, 85, 105);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `Página ${data.pageNumber} — Sistema de Conciliação Bancária`,
          PAGE_W / 2, pageH - 4, { align: 'center' }
        );
      },
    });

    const ts = new Date().toISOString().slice(0, 10);
    doc.save(`${filename}_${ts}.pdf`);
    AUDIT.log('export_pdf', `Relatório PDF exportado: ${filename}_${ts}.pdf`);
  }

  return { exportExcel, exportPDF };
})();
