import { transactionService } from './transactionService';
import { providerService } from './providerService';
import { conceptService } from './conceptService';
import { descriptionService } from './descriptionService';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

export const reportService = {
  // Get filtered transactions for reports
  async getFilteredTransactions(filters) {
    try {
      let transactions = [];
      
      if (filters.startDate && filters.endDate) {
        transactions = await transactionService.getByDateRange(
          filters.startDate, 
          filters.endDate,
          {
            type: filters.type,
            providerId: filters.providerId,
            conceptId: filters.conceptId
          }
        );
      } else {
        transactions = await transactionService.getAll({
          type: filters.type,
          providerId: filters.providerId,
          conceptId: filters.conceptId
        });
      }
      
      return transactions;
    } catch (error) {
      console.error('Error getting filtered transactions:', error);
      throw new Error('Error al obtener transacciones filtradas');
    }
  },

  // Generate report statistics
  async generateReportStats(transactions) {
    try {
      const stats = {
        totalTransactions: transactions.length,
        totalEntradas: 0,
        totalSalidas: 0,
        totalBalance: 0,
        entradasCount: 0,
        salidasCount: 0,
        averageEntrada: 0,
        averageSalida: 0,
        paymentStatus: {
          pendiente: { count: 0, amount: 0 },
          parcial: { count: 0, amount: 0 },
          pagado: { count: 0, amount: 0 }
        },
        conceptBreakdown: {},
        providerBreakdown: {},
        monthlyBreakdown: {}
      };

      // Get reference data
      const [concepts, providers, descriptions] = await Promise.all([
        conceptService.getAll(),
        providerService.getAll(),
        descriptionService.getAll()
      ]);

      const conceptMap = {};
      concepts.forEach(concept => {
        conceptMap[concept.id] = concept.name;
      });

      const providerMap = {};
      providers.forEach(provider => {
        providerMap[provider.id] = provider.name;
      });

      const descriptionMap = {};
      descriptions.forEach(description => {
        descriptionMap[description.id] = description.name;
      });

      // Process transactions
      transactions.forEach(transaction => {
        const amount = transaction.amount || 0;
        const conceptName = conceptMap[transaction.conceptId] || 'Sin concepto';
        const providerName = providerMap[transaction.providerId] || 'Sin proveedor';
        const month = new Date(transaction.date?.toDate ? transaction.date.toDate() : transaction.date)
          .toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });

        // Basic stats
        if (transaction.type === 'entrada') {
          stats.totalEntradas += amount;
          stats.entradasCount++;
        } else if (transaction.type === 'salida') {
          stats.totalSalidas += amount;
          stats.salidasCount++;
          
          // Payment status (only for salidas)
          const status = transaction.status || 'pendiente';
          if (stats.paymentStatus[status]) {
            stats.paymentStatus[status].count++;
            stats.paymentStatus[status].amount += transaction.balance || amount;
          }
        }

        // Concept breakdown
        if (!stats.conceptBreakdown[conceptName]) {
          stats.conceptBreakdown[conceptName] = {
            entradas: 0,
            salidas: 0,
            total: 0,
            count: 0
          };
        }
        
        if (transaction.type === 'entrada') {
          stats.conceptBreakdown[conceptName].entradas += amount;
        } else {
          stats.conceptBreakdown[conceptName].salidas += amount;
        }
        stats.conceptBreakdown[conceptName].total += amount;
        stats.conceptBreakdown[conceptName].count++;

        // Provider breakdown (only for salidas)
        if (transaction.type === 'salida' && transaction.providerId) {
          if (!stats.providerBreakdown[providerName]) {
            stats.providerBreakdown[providerName] = {
              amount: 0,
              count: 0,
              pendingAmount: 0
            };
          }
          
          stats.providerBreakdown[providerName].amount += amount;
          stats.providerBreakdown[providerName].count++;
          stats.providerBreakdown[providerName].pendingAmount += transaction.balance || 0;
        }

        // Monthly breakdown
        if (!stats.monthlyBreakdown[month]) {
          stats.monthlyBreakdown[month] = {
            entradas: 0,
            salidas: 0,
            balance: 0,
            count: 0
          };
        }
        
        if (transaction.type === 'entrada') {
          stats.monthlyBreakdown[month].entradas += amount;
        } else {
          stats.monthlyBreakdown[month].salidas += amount;
        }
        stats.monthlyBreakdown[month].balance = 
          stats.monthlyBreakdown[month].entradas - stats.monthlyBreakdown[month].salidas;
        stats.monthlyBreakdown[month].count++;
      });

      // Calculate derived stats
      stats.totalBalance = stats.totalEntradas - stats.totalSalidas;
      stats.averageEntrada = stats.entradasCount > 0 ? stats.totalEntradas / stats.entradasCount : 0;
      stats.averageSalida = stats.salidasCount > 0 ? stats.totalSalidas / stats.salidasCount : 0;

      return stats;
    } catch (error) {
      console.error('Error generating report stats:', error);
      throw new Error('Error al generar estadísticas del reporte');
    }
  },

  // Export to Excel
  async exportToExcel(transactions, stats, filters) {
    try {
      const workbook = XLSX.utils.book_new();

      // Get reference data for lookups
      const [concepts, providers, descriptions] = await Promise.all([
        conceptService.getAll(),
        providerService.getAll(),
        descriptionService.getAll()
      ]);

      const conceptMap = {};
      concepts.forEach(concept => {
        conceptMap[concept.id] = concept.name;
      });

      const providerMap = {};
      providers.forEach(provider => {
        providerMap[provider.id] = provider.name;
      });

      const descriptionMap = {};
      descriptions.forEach(description => {
        descriptionMap[description.id] = description.name;
      });

      // Transactions sheet
      const transactionsData = transactions.map(transaction => ({
        'ID': transaction.id,
        'Fecha': new Date(transaction.date?.toDate ? transaction.date.toDate() : transaction.date)
          .toLocaleDateString('es-ES'),
        'Tipo': transaction.type,
        'Concepto': conceptMap[transaction.conceptId] || 'Sin concepto',
        'Descripción': descriptionMap[transaction.descriptionId] || 'Sin descripción',
        'Proveedor': providerMap[transaction.providerId] || 'N/A',
        'Monto': transaction.amount,
        'Estado': transaction.status || 'pendiente',
        'Total Pagado': transaction.totalPaid || 0,
        'Saldo': transaction.balance || transaction.amount
      }));

      const transactionsSheet = XLSX.utils.json_to_sheet(transactionsData);
      XLSX.utils.book_append_sheet(workbook, transactionsSheet, 'Transacciones');

      // Summary sheet
      const summaryData = [
        ['Estadística', 'Valor'],
        ['Total de Transacciones', stats.totalTransactions],
        ['Total Entradas', `$${stats.totalEntradas.toLocaleString('es-MX')}`],
        ['Total Salidas', `$${stats.totalSalidas.toLocaleString('es-MX')}`],
        ['Balance Total', `$${stats.totalBalance.toLocaleString('es-MX')}`],
        ['Promedio Entradas', `$${stats.averageEntrada.toLocaleString('es-MX')}`],
        ['Promedio Salidas', `$${stats.averageSalida.toLocaleString('es-MX')}`],
        [''],
        ['Estado de Pagos', ''],
        ['Pendientes', `${stats.paymentStatus.pendiente.count} ($${stats.paymentStatus.pendiente.amount.toLocaleString('es-MX')})`],
        ['Parciales', `${stats.paymentStatus.parcial.count} ($${stats.paymentStatus.parcial.amount.toLocaleString('es-MX')})`],
        ['Pagados', `${stats.paymentStatus.pagado.count} ($${stats.paymentStatus.pagado.amount.toLocaleString('es-MX')})`]
      ];

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');

      // Concept breakdown sheet
      const conceptData = Object.entries(stats.conceptBreakdown).map(([concept, data]) => ({
        'Concepto': concept,
        'Entradas': `$${data.entradas.toLocaleString('es-MX')}`,
        'Salidas': `$${data.salidas.toLocaleString('es-MX')}`,
        'Total': `$${data.total.toLocaleString('es-MX')}`,
        'Cantidad': data.count
      }));

      const conceptSheet = XLSX.utils.json_to_sheet(conceptData);
      XLSX.utils.book_append_sheet(workbook, conceptSheet, 'Por Concepto');

      // Generate filename
      const now = new Date();
      const filename = `reporte_${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}.xlsx`;

      // Save file
      XLSX.writeFile(workbook, filename);
      
      return filename;
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      throw new Error('Error al exportar a Excel');
    }
  },

  // Export to PDF
  async exportToPDF(transactions, stats, filters) {
    try {
      // Create document with custom options
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      // Define colors
      const primaryColor = [0, 102, 204]; // Azul
      const secondaryColor = [0, 153, 51]; // Verde
      const accentColor = [204, 0, 0];    // Rojo
      const textColor = [51, 51, 51];     // Gris oscuro
      
      // Add logo
      try {
        const logoPath = '/Users/void/Documents/santiago/santiago-fc/public/logo.jpeg';
        doc.addImage(logoPath, 'JPEG', 10, 10, 30, 20);
      } catch (logoError) {
        console.error('Error adding logo:', logoError);
        // Continue without logo if there's an error
      }
      
      // Add header with background
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 35, 'F');
      
      // Title
      doc.setFontSize(24);
      doc.setTextColor(255, 255, 255); // Blanco
      doc.setFont('helvetica', 'bold');
      doc.text('Reporte de Transacciones', 105, 20, { align: 'center' });
      
      // Reset text color
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.setFont('helvetica', 'normal');
      
      // Date range
      let dateRange = 'Todas las fechas';
      if (filters.startDate && filters.endDate) {
        // Safely convert string dates to Date objects
        let startDate, endDate;
        
        try {
          startDate = typeof filters.startDate === 'string' ? new Date(filters.startDate) : filters.startDate;
          endDate = typeof filters.endDate === 'string' ? new Date(filters.endDate) : filters.endDate;
          
          // Verify the dates are valid
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            throw new Error('Invalid date format');
          }
          
          dateRange = `${startDate.toLocaleDateString('es-ES')} - ${endDate.toLocaleDateString('es-ES')}`;
        } catch (err) {
          console.error('Error formatting dates for PDF:', err);
          dateRange = 'Período personalizado';
        }
      }
      
      // Add date information with styled box
      doc.setFillColor(240, 240, 240); // Light gray background
      doc.roundedRect(10, 40, 190, 10, 2, 2, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`Período: ${dateRange}`, 15, 46);
      
      // Current date
      const now = new Date();
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text(`Generado: ${now.toLocaleDateString('es-ES')} ${now.toLocaleTimeString('es-ES')}`, 195, 46, { align: 'right' });
      
      // Summary statistics with styled section
      doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.setDrawColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.roundedRect(10, 55, 190, 8, 1, 1, 'FD');
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('Resumen', 15, 61);
      
      // Reset text color
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.setFont('helvetica', 'normal');
      
      const summaryData = [
        ['Total Transacciones', stats.totalTransactions.toString()],
        ['Total Entradas', `$${stats.totalEntradas.toLocaleString('es-MX')}`],
        ['Total Salidas', `$${stats.totalSalidas.toLocaleString('es-MX')}`],
        ['Balance', `$${stats.totalBalance.toLocaleString('es-MX')}`]
      ];
      
      // Styled table for summary
      autoTable(doc, {
        startY: 65,
        head: [['Estadística', 'Valor']],
        body: summaryData,
        theme: 'grid',
        headStyles: {
          fillColor: [220, 220, 220],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          halign: 'center'
        },
        alternateRowStyles: {
          fillColor: [240, 240, 240]
        },
        columnStyles: {
          0: { fontStyle: 'bold' },
          1: { halign: 'right' }
        },
        margin: { left: 10, right: 10 }
      });
      
      // Concept breakdown
      if (Object.keys(stats.conceptBreakdown).length > 0) {
        doc.addPage();
        
        // Add header with background to new page
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(0, 0, 210, 35, 'F');
        
        // Add logo to new page
        try {
          const logoPath = '/Users/void/Documents/santiago/santiago-fc/public/logo.jpeg';
          doc.addImage(logoPath, 'JPEG', 10, 10, 30, 20);
        } catch (logoError) {
          // Continue without logo if there's an error
        }
        
        // Title on new page
        doc.setFontSize(24);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text('Reporte de Transacciones', 105, 20, { align: 'center' });
        
        // Section title with styled background
        doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.setDrawColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.roundedRect(10, 40, 190, 8, 1, 1, 'FD');
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('Desglose por Concepto', 15, 46);
        
        // Reset text color
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.setFont('helvetica', 'normal');
        
        const conceptData = Object.entries(stats.conceptBreakdown).map(([concept, data]) => [
          concept,
          `$${data.entradas.toLocaleString('es-MX')}`,
          `$${data.salidas.toLocaleString('es-MX')}`,
          `$${data.total.toLocaleString('es-MX')}`,
          data.count.toString()
        ]);
        
        // Styled table for concepts
        autoTable(doc, {
          startY: 50,
          head: [['Concepto', 'Entradas', 'Salidas', 'Total', 'Cantidad']],
          body: conceptData,
          theme: 'grid',
          headStyles: {
            fillColor: [220, 220, 220],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            halign: 'center'
          },
          alternateRowStyles: {
            fillColor: [240, 240, 240]
          },
          columnStyles: {
            0: { fontStyle: 'bold' },
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'center' }
          },
          margin: { left: 10, right: 10 }
        });
      }
      
      // Transactions table
      if (transactions.length > 0) {
        doc.addPage();
        
        // Add header with background to new page
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(0, 0, 210, 35, 'F');
        
        // Add logo to new page
        try {
          const logoPath = '/Users/void/Documents/santiago/santiago-fc/public/logo.jpeg';
          doc.addImage(logoPath, 'JPEG', 10, 10, 30, 20);
        } catch (logoError) {
          // Continue without logo if there's an error
        }
        
        // Title on new page
        doc.setFontSize(24);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text('Reporte de Transacciones', 105, 20, { align: 'center' });
        
        // Section title with styled background
        doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.setDrawColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.roundedRect(10, 40, 190, 8, 1, 1, 'FD');
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('Detalle de Transacciones', 15, 46);
        
        // Reset text color
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.setFont('helvetica', 'normal');
        
        // Get reference data for lookups
        const [concepts, providers, descriptions] = await Promise.all([
          conceptService.getAll(),
          providerService.getAll(),
          descriptionService.getAll()
        ]);

        const conceptMap = {};
        concepts.forEach(concept => {
          conceptMap[concept.id] = concept.name;
        });

        const providerMap = {};
        providers.forEach(provider => {
          providerMap[provider.id] = provider.name;
        });

        const transactionData = transactions.slice(0, 50).map(transaction => [
          new Date(transaction.date?.toDate ? transaction.date.toDate() : transaction.date)
            .toLocaleDateString('es-ES'),
          transaction.type,
          conceptMap[transaction.conceptId] || 'Sin concepto',
          providerMap[transaction.providerId] || 'N/A',
          `$${transaction.amount.toLocaleString('es-MX')}`,
          transaction.status || 'pendiente'
        ]);
        
        // Styled table for transactions
        autoTable(doc, {
          startY: 50,
          head: [['Fecha', 'Tipo', 'Concepto', 'Proveedor', 'Monto', 'Estado']],
          body: transactionData,
          theme: 'grid',
          styles: { fontSize: 9 },
          headStyles: {
            fillColor: [220, 220, 220],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            halign: 'center'
          },
          alternateRowStyles: {
            fillColor: [240, 240, 240]
          },
          columnStyles: {
            0: { halign: 'center' },
            1: { halign: 'center' },
            4: { halign: 'right' },
            5: { halign: 'center' }
          },
          margin: { left: 10, right: 10 }
        });
        
        if (transactions.length > 50) {
          // Add note about limited transactions with styled box
          const finalY = doc.lastAutoTable.finalY;
          doc.setFillColor(240, 240, 240);
          doc.roundedRect(10, finalY + 5, 190, 8, 1, 1, 'F');
          doc.setFontSize(10);
          doc.setFont('helvetica', 'italic');
          doc.text(`Mostrando primeras 50 de ${transactions.length} transacciones`, 105, finalY + 10, { align: 'center' });
        }
      }
      
      // Add footer to all pages
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        
        // Footer line
        doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setLineWidth(0.5);
        doc.line(10, 285, 200, 285);
        
        // Footer text
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'normal');
        doc.text('Santiago Fútbol Club - Sistema de Administración', 105, 290, { align: 'center' });
        doc.text(`Página ${i} de ${totalPages}`, 195, 290, { align: 'right' });
      }
      
      // Generate filename
      const currentDate = new Date();
      const filename = `reporte_${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}.pdf`;
      
      // Save file
      doc.save(filename);
      
      return filename;
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      throw new Error('Error al exportar a PDF');
    }
  }
};