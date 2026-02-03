/**
 * Enhanced PDF templates for Santiago FC reports
 * Matching the design style of email templates
 */

import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { addLogoToPDF } from '../utils/logoUtils';

// Define colors matching email template
const COLORS = {
    primary: [220, 38, 38],      // #dc2626 - Red
    secondary: [245, 245, 245],  // Light gray
    accent: [185, 28, 28],       // Darker red
    text: [51, 51, 51],          // Dark gray
    success: [0, 153, 51],       // Green
    danger: [220, 53, 69],       // Red
    warning: [255, 193, 7],      // Yellow/amber
    white: [255, 255, 255],
    lightGray: [249, 249, 249]
};

/**
 * Helper function to add page header with Santiago FC branding
 */
export const addPageHeader = async (doc, title = 'Reporte Administrativo', totalTransactions = null) => {
    console.log('🎨 Generando header del PDF...');
    
    // Header background with gradient effect
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, 210, 40, 'F');

    // Add subtle shadow effect
    doc.setFillColor(0, 0, 0, 0.1);
    doc.rect(0, 40, 210, 2, 'F');

    // Add Santiago FC logo
    console.log('🖼️ Añadiendo logo al PDF...');
    try {
        const logoAdded = await addLogoToPDF(doc, 15, 8, 25, 25);
        if (logoAdded) {
            console.log('✅ Logo añadido exitosamente');
        } else {
            console.log('⚠️ Logo fallback aplicado');
        }
    } catch (error) {
        console.error('❌ Error añadiendo logo:', error);
    }

    // Main title with better typography
    doc.setFontSize(22);
    doc.setTextColor(...COLORS.white);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 105, 18, { align: 'center' });

    // Subtitle
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (totalTransactions) {
        doc.text('Sistema de Administración Financiera', 105, 25, { align: 'center' });
        doc.setFontSize(9);
        doc.text(`Total de Transacciones: ${totalTransactions}`, 105, 30, { align: 'center' });
    } else {
        doc.text('Sistema de Administración Financiera', 105, 26, { align: 'center' });
    }

    // Date and time info
    const now = new Date();
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(`Generado: ${now.toLocaleDateString('es-ES')} ${now.toLocaleTimeString('es-ES')}`, 195, 35, { align: 'right' });
};

/**
 * Helper function to add section header
 */
export const addSectionHeader = (doc, title, yPosition, icon = '') => {
    // Section background
    doc.setFillColor(...COLORS.secondary);
    doc.roundedRect(15, yPosition, 180, 12, 2, 2, 'F');

    // Section border
    doc.setDrawColor(...COLORS.primary);
    doc.setLineWidth(0.5);
    doc.roundedRect(15, yPosition, 180, 12, 2, 2, 'D');

    // Section title
    doc.setFontSize(14);
    doc.setTextColor(...COLORS.text);
    doc.setFont('helvetica', 'bold');
    doc.text(`${icon} ${title}`, 20, yPosition + 8);

    return yPosition + 15;
};

/**
 * Helper function to create info cards
 */
export const createInfoCard = (doc, x, y, width, height, title, value, color = COLORS.text, subtitle = '') => {
    // Validate parameters
    if (!doc || x === undefined || y === undefined || !title || !value) {
        console.error('createInfoCard: Invalid parameters', { x, y, title, value });
        return;
    }

    // Ensure parameters are properly formatted
    const safeTitle = String(title || '');
    const safeValue = String(value || '');
    const safeSubtitle = String(subtitle || '');

    // Card background
    doc.setFillColor(...COLORS.white);
    doc.roundedRect(x, y, width, height, 2, 2, 'F');

    // Card border
    doc.setDrawColor(...color);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, width, height, 2, 2, 'D');

    // Accent line at top
    doc.setFillColor(...color);
    doc.roundedRect(x, y, width, 3, 2, 2, 'F');

    // Title
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text(safeTitle, x + 5, y + 12);

    // Value
    doc.setFontSize(16);
    doc.setTextColor(...color);
    doc.setFont('helvetica', 'bold');
    doc.text(safeValue, x + 5, y + 22);

    // Subtitle if provided
    if (safeSubtitle) {
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.setFont('helvetica', 'normal');
        doc.text(safeSubtitle, x + 5, y + 28);
    }
};

/**
 * Add enhanced footer to all pages
 */
export const addEnhancedFooter = (doc) => {
    const totalPages = doc.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        // Footer background
        doc.setFillColor(250, 250, 250);
        doc.rect(0, 285, 210, 12, 'F');

        // Footer line
        doc.setDrawColor(...COLORS.primary);
        doc.setLineWidth(0.8);
        doc.line(15, 285, 195, 285);

        // Footer content
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'normal');
        doc.text('Santiago Futbol Club - Sistema de Administracion Financiera', 20, 292);
        doc.text(`Página ${i} de ${totalPages}`, 190, 292, { align: 'right' });

        // Add generation timestamp on last page
        if (i === totalPages) {
            const now = new Date();
            doc.setFontSize(7);
            doc.text(`Documento generado automáticamente el ${now.toLocaleString('es-ES')}`, 105, 295, { align: 'center' });
        }
    }
};

/**
 * Create enhanced PDF report with modern design
 */
export const createEnhancedPDFReport = async (transactions, stats, filters, conceptService, providerService) => {
    // Create document with custom options
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    // Start first page
    await addPageHeader(doc, 'Reporte Administrativo', stats.totalTransactions);

    // Date range information
    let dateRange = 'Todas las fechas';
    if (filters.startDate && filters.endDate) {
        try {
            const startDate = typeof filters.startDate === 'string' ? new Date(filters.startDate) : filters.startDate;
            const endDate = typeof filters.endDate === 'string' ? new Date(filters.endDate) : filters.endDate;

            if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                dateRange = `${startDate.toLocaleDateString('es-ES')} - ${endDate.toLocaleDateString('es-ES')}`;
            }
        } catch (err) {
            console.error('Error formatting dates for PDF:', err);
            dateRange = 'Período personalizado';
        }
    }

    // Period info card
    doc.setFillColor(...COLORS.primary);
    doc.roundedRect(15, 45, 180, 15, 3, 3, 'F');
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.white);
    doc.setFont('helvetica', 'bold');
    doc.text(`Periodo del Reporte: ${dateRange}`, 20, 55);

    // Summary statistics section
    let currentY = addSectionHeader(doc, 'Resumen Ejecutivo', 65);

    // Create summary cards in a grid
    const cardWidth = 42;
    const cardHeight = 35;
    const cardSpacing = 4;

    // Row 1: Main financial metrics (4 cards only)
    createInfoCard(doc, 15, currentY, cardWidth, cardHeight, 'Arrastre de Ingresos',
        `$${(stats.carryoverIncome || 0).toLocaleString('es-MX')}`, COLORS.success, 'Del mes anterior');

    createInfoCard(doc, 15 + cardWidth + cardSpacing, currentY, cardWidth, cardHeight, 'Total Ingresos',
        `$${stats.totalEntradas.toLocaleString('es-MX')}`, COLORS.success, `${stats.entradasCount} entradas`);

    createInfoCard(doc, 15 + (cardWidth + cardSpacing) * 2, currentY, cardWidth, cardHeight, 'Total Gastos',
        `$${stats.totalSalidas.toLocaleString('es-MX')}`, COLORS.danger, `${stats.salidasCount} salidas`);

    createInfoCard(doc, 15 + (cardWidth + cardSpacing) * 3, currentY, cardWidth, cardHeight, 'Balance Total',
        `$${stats.totalBalance.toLocaleString('es-MX')}`,
        stats.totalBalance >= 0 ? COLORS.success : COLORS.danger,
        stats.totalBalance >= 0 ? 'Positivo' : 'Negativo');

    currentY += cardHeight + 10;

    // Desglose del Mes section
    currentY = addSectionHeader(doc, 'Desglose del Mes', currentY);

    createInfoCard(doc, 15, currentY, 58, cardHeight, 'Ingreso Total del Mes',
        `$${stats.totalEntradas.toLocaleString('es-MX')}`, COLORS.success,
        `${stats.entradasCount} transacciones`);

    createInfoCard(doc, 78, currentY, 58, cardHeight, 'Gasto Total del Mes',
        `$${stats.totalSalidas.toLocaleString('es-MX')}`, COLORS.danger,
        `${stats.salidasCount} transacciones`);

    createInfoCard(doc, 141, currentY, 54, cardHeight, 'Balance del Mes',
        `$${(stats.totalEntradas - stats.totalSalidas).toLocaleString('es-MX')}`,
        (stats.totalEntradas - stats.totalSalidas) >= 0 ? COLORS.success : COLORS.danger,
        'Solo este período');

    currentY += cardHeight + 10;

    // Payment status for expenses
    if (stats.salidasCount > 0) {
        currentY = addSectionHeader(doc, 'Estado de Gastos', currentY);

        const statusColors = {
            pagado: COLORS.success,
            parcial: COLORS.warning,
            pendiente: COLORS.danger
        };

        const statusLabels = {
            pagado: 'Pagados',
            parcial: 'Parciales',
            pendiente: 'Pendientes'
        };

        let cardX = 15;
        Object.entries(stats.paymentStatus).forEach(([status, data]) => {
            if (data.count > 0) {
                createInfoCard(doc, cardX, currentY, 58, cardHeight, statusLabels[status],
                    data.count.toString(), statusColors[status],
                    `$${(data.amount + (data.carryover || 0)).toLocaleString('es-MX')}`);
                cardX += 62;
            }
        });

        currentY += cardHeight + 15;
    }

    // General breakdown - Move to appear first
    if (Object.keys(stats.generalBreakdown).length > 0) {
        // Check if we need a new page
        if (currentY > 180) {
            doc.addPage();
            await addPageHeader(doc, 'Reporte Administrativo');
            currentY = 50;
        }

        currentY = addSectionHeader(doc, 'Desglose por Generales', currentY);

        const generalData = Object.entries(stats.generalBreakdown)
            .sort(([, a], [, b]) => (b.salidas + b.entradas) - (a.salidas + a.entradas))
            .map(([general, data]) => [
                general,
                `$${data.entradas.toLocaleString('es-MX')}`,
                `$${data.salidas.toLocaleString('es-MX')}`,
                `$${(data.entradas - data.salidas).toLocaleString('es-MX')}`,
                data.count.toString()
            ]);

        autoTable(doc, {
            startY: currentY,
            head: [['Categoría General', 'Ingresos', 'Gastos', 'Balance', 'Transacciones']],
            body: generalData,
            theme: 'grid',
            headStyles: {
                fillColor: COLORS.primary,
                textColor: COLORS.white,
                fontStyle: 'bold',
                halign: 'center',
                fontSize: 10
            },
            bodyStyles: {
                fontSize: 9,
                textColor: COLORS.text
            },
            alternateRowStyles: {
                fillColor: COLORS.lightGray
            },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 60 },
                1: { halign: 'right', textColor: COLORS.success, cellWidth: 30 },
                2: { halign: 'right', textColor: COLORS.danger, cellWidth: 30 },
                3: { halign: 'right', fontStyle: 'bold', cellWidth: 30 },
                4: { halign: 'center', cellWidth: 30 }
            },
            margin: { left: 15, right: 15 },
            styles: {
                lineColor: [220, 220, 220],
                lineWidth: 0.1,
                halign: 'left'
            }
        });

        currentY = doc.lastAutoTable.finalY + 10;
    }

    // Concept breakdown table
    if (Object.keys(stats.conceptBreakdown).length > 0) {
        // Check if we need a new page
        if (currentY > 200) {
            doc.addPage();
            await addPageHeader(doc, 'Reporte Administrativo');
            currentY = 50;
        }

        currentY = addSectionHeader(doc, 'Desglose por Concepto', currentY);

        const conceptData = Object.entries(stats.conceptBreakdown)
            .sort(([, a], [, b]) => b.total - a.total) // Sort by total amount
            .map(([concept, data]) => [
                concept,
                `$${data.entradas.toLocaleString('es-MX')}`,
                `$${data.salidas.toLocaleString('es-MX')}`,
                `$${data.total.toLocaleString('es-MX')}`,
                data.count.toString()
            ]);

        autoTable(doc, {
            startY: currentY,
            head: [['Concepto', 'Ingresos', 'Gastos', 'Total', 'Cantidad']],
            body: conceptData,
            theme: 'grid',
            headStyles: {
                fillColor: COLORS.primary,
                textColor: COLORS.white,
                fontStyle: 'bold',
                halign: 'center',
                fontSize: 10
            },
            bodyStyles: {
                fontSize: 9,
                textColor: COLORS.text
            },
            alternateRowStyles: {
                fillColor: COLORS.lightGray
            },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 60 },
                1: { halign: 'right', textColor: COLORS.success, cellWidth: 30 },
                2: { halign: 'right', textColor: COLORS.danger, cellWidth: 30 },
                3: { halign: 'right', fontStyle: 'bold', cellWidth: 35 },
                4: { halign: 'center', cellWidth: 25 }
            },
            margin: { left: 15, right: 15 },
            styles: {
                lineColor: [220, 220, 220],
                lineWidth: 0.1,
                halign: 'left'
            }
        });

        currentY = doc.lastAutoTable.finalY + 10;
    }

    // Provider breakdown if applicable
    if (Object.keys(stats.providerBreakdown).length > 0) {
        // Check if we need a new page
        if (currentY > 220) {
            doc.addPage();
            await addPageHeader(doc, 'Reporte Administrativo');
            currentY = 50;
        }

        currentY = addSectionHeader(doc, 'Desglose por Proveedor', currentY);

        const providerData = Object.entries(stats.providerBreakdown)
            .sort(([, a], [, b]) => b.amount - a.amount)
            .map(([provider, data]) => [
                provider,
                `$${data.amount.toLocaleString('es-MX')}`,
                `$${data.pendingAmount.toLocaleString('es-MX')}`,
                data.count.toString()
            ]);

        autoTable(doc, {
            startY: currentY,
            head: [['Proveedor', 'Monto Total', 'Saldo Pendiente', 'Transacciones']],
            body: providerData,
            theme: 'grid',
            headStyles: {
                fillColor: COLORS.primary,
                textColor: COLORS.white,
                fontStyle: 'bold',
                halign: 'center',
                fontSize: 10
            },
            bodyStyles: {
                fontSize: 9,
                textColor: COLORS.text
            },
            alternateRowStyles: {
                fillColor: COLORS.lightGray
            },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 80 },
                1: { halign: 'right', cellWidth: 40 },
                2: { halign: 'right', textColor: COLORS.danger, cellWidth: 40 },
                3: { halign: 'center', cellWidth: 30 }
            },
            margin: { left: 15, right: 15 },
            styles: {
                lineColor: [220, 220, 220],
                lineWidth: 0.1,
                halign: 'left'
            }
        });

        currentY = doc.lastAutoTable.finalY + 10;
    }

    // Division breakdown if applicable (only for gastos)
    if (Object.keys(stats.divisionBreakdown || {}).length > 0) {
        // Check if we need a new page
        if (currentY > 200) {
            doc.addPage();
            await addPageHeader(doc, 'Reporte Administrativo');
            currentY = 50;
        }

        currentY = addSectionHeader(doc, 'Desglose por División (Solo Gastos)', currentY);

        // Create cards for divisions
        const divisions = Object.entries(stats.divisionBreakdown)
            .sort(([, a], [, b]) => b.amount - a.amount);

        const cardWidth = 58;
        const cardHeight = 30;
        const cardSpacing = 4;
        let cardX = 15;
        let cardRow = 0;

        divisions.forEach(([division, data], index) => {
            if (index > 0 && index % 3 === 0) {
                cardRow++;
                cardX = 15;
            }

            const yPos = currentY + (cardRow * (cardHeight + 5));
            
            // Validate division data before creating card
            const safeDivision = division && division.trim() ? division : 'Sin División';
            const safeAmount = data.amount || 0;
            const safeCount = data.count || 0;
            
            createInfoCard(doc, cardX, yPos, cardWidth, cardHeight, safeDivision,
                `$${safeAmount.toLocaleString('es-MX')}`, COLORS.accent,
                `${safeCount} transacciones`);

            cardX += cardWidth + cardSpacing;
        });

        currentY += (Math.ceil(divisions.length / 3) * (cardHeight + 5)) + 10;
    }

    // Summary boxes for General and Divisions at the end of first page
    if (currentY < 220) {
        currentY = addSectionHeader(doc, 'Resumen Final - Gastos por Categoría y División', currentY);

        // General breakdown summary (only expenses)
        if (Object.keys(stats.generalBreakdown).length > 0) {
            doc.setFontSize(12);
            doc.setTextColor(...COLORS.text);
            doc.setFont('helvetica', 'bold');
            doc.text('Gastos por Categoría General:', 20, currentY + 5);

            const generalExpenses = Object.entries(stats.generalBreakdown)
                .filter(([, data]) => data.salidas > 0)
                .sort(([, a], [, b]) => b.salidas - a.salidas)
                .slice(0, 5); // Top 5

            let boxY = currentY + 10;
            generalExpenses.forEach(([general, data]) => {
                // Validate data before creating box
                const safeGeneral = general && general.trim() ? general : 'Sin Categoría';
                const safeSalidas = data.salidas || 0;
                const safeCount = data.count || 0;

                // Create small summary box
                doc.setFillColor(...COLORS.secondary);
                doc.roundedRect(20, boxY, 80, 8, 1, 1, 'F');
                doc.setDrawColor(...COLORS.primary);
                doc.setLineWidth(0.2);
                doc.roundedRect(20, boxY, 80, 8, 1, 1, 'D');

                doc.setFontSize(9);
                doc.setTextColor(...COLORS.text);
                doc.setFont('helvetica', 'normal');
                doc.text(safeGeneral, 22, boxY + 3);
                doc.setFont('helvetica', 'bold');
                doc.text(`$${safeSalidas.toLocaleString('es-MX')}`, 98, boxY + 3, { align: 'right' });
                doc.setFont('helvetica', 'normal');
                doc.text(`(${safeCount} transacciones)`, 22, boxY + 6);

                boxY += 10;
            });

            currentY = boxY + 5;
        }

        // Division breakdown summary (if space allows)
        if (Object.keys(stats.divisionBreakdown || {}).length > 0 && currentY < 250) {
            // Calculate the starting Y position for divisions section
            const generalExpensesCount = Object.entries(stats.generalBreakdown)
                .filter(([, data]) => data.salidas > 0).length;
            const divisionStartY = currentY - Math.min(5, generalExpensesCount) * 10;

            doc.setFontSize(12);
            doc.setTextColor(...COLORS.text);
            doc.setFont('helvetica', 'bold');
            doc.text('Gastos por División:', 110, divisionStartY + 5);

            const divisionExpenses = Object.entries(stats.divisionBreakdown)
                .sort(([, a], [, b]) => b.amount - a.amount)
                .slice(0, 5); // Top 5

            let boxY = divisionStartY + 10;
            divisionExpenses.forEach(([division, data]) => {
                // Validate data before creating box
                const safeDivision = division && division.trim() ? division : 'Sin División';
                const safeAmount = data.amount || 0;
                const safeCount = data.count || 0;

                // Create small summary box
                doc.setFillColor(...COLORS.secondary);
                doc.roundedRect(110, boxY, 80, 8, 1, 1, 'F');
                doc.setDrawColor(...COLORS.accent);
                doc.setLineWidth(0.2);
                doc.roundedRect(110, boxY, 80, 8, 1, 1, 'D');

                doc.setFontSize(9);
                doc.setTextColor(...COLORS.text);
                doc.setFont('helvetica', 'normal');
                doc.text(safeDivision, 112, boxY + 3);
                doc.setFont('helvetica', 'bold');
                doc.text(`$${safeAmount.toLocaleString('es-MX')}`, 188, boxY + 3, { align: 'right' });
                doc.setFont('helvetica', 'normal');
                doc.text(`(${safeCount} transacciones)`, 112, boxY + 6);

                boxY += 10;
            });

            currentY = Math.max(currentY, boxY + 5);
        }
    }

    // Transactions detail (limited to first 100 for performance)
    if (transactions.length > 0) {
        doc.addPage();
        await addPageHeader(doc, 'Detalle de Transacciones');

        currentY = addSectionHeader(doc, 'Listado de Transacciones', 50);

        // Get reference data for lookups
        const [concepts, providers] = await Promise.all([
            conceptService.getAll(),
            providerService.getAll()
        ]);

        const conceptMap = {};
        concepts.forEach(concept => {
            conceptMap[concept.id] = concept.name;
        });

        const providerMap = {};
        providers.forEach(provider => {
            providerMap[provider.id] = provider.name;
        });

        const transactionData = transactions.slice(0, 100).map(transaction => {
            const date = new Date(transaction.date?.toDate ? transaction.date.toDate() : transaction.date);
            const typeText = transaction.type === 'entrada' ? 'Ingreso' : 'Gasto';
            const statusText = transaction.status === 'pagado' ? 'Pagado' :
                transaction.status === 'parcial' ? 'Parcial' : 'Pendiente';

            return [
                date.toLocaleDateString('es-ES'),
                typeText,
                conceptMap[transaction.conceptId] || 'Sin concepto',
                providerMap[transaction.providerId] || 'N/A',
                `$${transaction.amount.toLocaleString('es-MX')}`,
                statusText
            ];
        });

        autoTable(doc, {
            startY: currentY,
            head: [['Fecha', 'Tipo', 'Concepto', 'Proveedor', 'Monto', 'Estado']],
            body: transactionData,
            theme: 'grid',
            headStyles: {
                fillColor: COLORS.primary,
                textColor: COLORS.white,
                fontStyle: 'bold',
                halign: 'center',
                fontSize: 9
            },
            bodyStyles: {
                textColor: COLORS.text,
                fontSize: 8
            },
            alternateRowStyles: {
                fillColor: COLORS.lightGray
            },
            columnStyles: {
                0: { halign: 'center', cellWidth: 25 },
                1: { halign: 'center', cellWidth: 25 },
                2: { cellWidth: 45 },
                3: { cellWidth: 40 },
                4: { halign: 'right', cellWidth: 30 },
                5: { halign: 'center', cellWidth: 25 }
            },
            margin: { left: 15, right: 15 },
            styles: {
                fontSize: 8,
                cellPadding: 2,
                lineColor: [220, 220, 220],
                lineWidth: 0.1,
                halign: 'left'
            }
        });

        if (transactions.length > 100) {
            const finalY = doc.lastAutoTable.finalY;
            doc.setFillColor(255, 248, 220); // Light yellow background
            doc.roundedRect(15, finalY + 5, 180, 12, 2, 2, 'F');
            doc.setFontSize(10);
            doc.setTextColor(...COLORS.text);
            doc.setFont('helvetica', 'italic');
            doc.text(`Mostrando primeras 100 de ${transactions.length} transacciones totales`, 105, finalY + 12, { align: 'center' });
        }
    }

    // Add enhanced footer to all pages
    addEnhancedFooter(doc);

    return doc;
};