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
 * Helper function to format currency with 2 decimal places
 */
const formatCurrency = (amount) => {
    return amount.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2});
};

/**
 * Helper function to add page header with Santiago FC branding
 */
export const addPageHeader = async (doc, title = 'Reporte Administrativo', totalTransactions = null) => {
    console.log('Generando header del PDF...');
    
    // Header background with gradient effect
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, 210, 40, 'F');

    // Add subtle shadow effect
    doc.setFillColor(0, 0, 0, 0.1);
    doc.rect(0, 40, 210, 2, 'F');

    // Add Santiago FC logo
    console.log('Añadiendo logo al PDF...');
    try {
        const logoAdded = await addLogoToPDF(doc, 15, 8, 25);
        if (logoAdded) {
            console.log('Logo añadido exitosamente');
        } else {
            console.log('Logo fallback aplicado');
        }
    } catch (error) {
        console.error('Error añadiendo logo:', error);
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
    // Section title - solo texto sin badge
    doc.setFontSize(13);
    doc.setTextColor(...COLORS.text);
    doc.setFont('helvetica', 'bold');
    doc.text(`${icon} ${title}`, 15, yPosition + 3);

    return yPosition + 8;
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

    // Card border - solo borde fino de color
    doc.setDrawColor(...color);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, width, height, 2, 2, 'D');

    // Title
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text(safeTitle, x + 4, y + 8);

    // Value
    doc.setFontSize(14);
    doc.setTextColor(...color);
    doc.setFont('helvetica', 'bold');
    doc.text(safeValue, x + 4, y + 17);

    // Subtitle if provided
    if (safeSubtitle) {
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.setFont('helvetica', 'normal');
        doc.text(safeSubtitle, x + 4, y + 24);
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
        doc.text('Sistema de Entradas y Salidas - Abanzoft', 20, 292);
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
export const createEnhancedPDFReport = async (transactions, stats, filters, conceptService, providerService, generalService, subconceptService) => {
    // Create document with custom options
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    // Start first page
    await addPageHeader(doc, 'Reporte Administrativo', stats.totalTransactions);

    // Helper function to parse date string as local date without timezone conversion
    const parseDateLocal = (dateInput) => {
        if (!dateInput) return null;
        
        // If it's already a Date object, return it
        if (dateInput instanceof Date) {
            return dateInput;
        }
        
        // If it's a string, parse as local date
        if (typeof dateInput === 'string') {
            const [year, month, day] = dateInput.split('-').map(Number);
            return new Date(year, month - 1, day);
        }
        
        return dateInput;
    };

    // Date range information
    let dateRange = 'Todas las fechas';
    if (filters.startDate && filters.endDate) {
        try {
            const startDate = parseDateLocal(filters.startDate);
            const endDate = parseDateLocal(filters.endDate);

            if (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                // Formato personalizado: "31 Enero 2026"
                const formatDate = (date) => {
                    const day = date.getDate();
                    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                    const month = monthNames[date.getMonth()];
                    const year = date.getFullYear();
                    return day + ' ' + month + ' ' + year;
                };
                
                dateRange = formatDate(startDate) + ' - ' + formatDate(endDate);
            }
        } catch (err) {
            console.error('Error formatting dates for PDF:', err);
            dateRange = 'Periodo personalizado';
        }
    }

    // Period info - Simple text without background
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.text);
    doc.setFont('helvetica', 'normal');
    const periodLabel = 'Periodo del Reporte: ';
    const labelWidth = doc.getTextWidth(periodLabel);
    doc.text(periodLabel, 15, 50);
    doc.setFont('helvetica', 'bold');
    doc.text(dateRange, 15 + labelWidth, 50);

    // Summary statistics section
    let currentY = addSectionHeader(doc, 'Resumen Ejecutivo', 58);

    // Create summary cards in a grid - más anchas y menos espacio
    const cardWidth = 46;
    const cardHeight = 28;
    const cardSpacing = 2;

    // Row 1: Main financial metrics (4 cards only)
    createInfoCard(doc, 15, currentY, cardWidth, cardHeight, 'Arrastre de Entradas',
        `$${formatCurrency(stats.carryoverIncome || 0)}`, COLORS.success, 'Del mes anterior');

    createInfoCard(doc, 15 + cardWidth + cardSpacing, currentY, cardWidth, cardHeight, 'Total Entradas',
        `$${formatCurrency(stats.totalEntradas)}`, COLORS.success, `${stats.entradasCount} entradas`);

    createInfoCard(doc, 15 + (cardWidth + cardSpacing) * 2, currentY, cardWidth, cardHeight, 'Total Salidas',
        `$${formatCurrency(stats.totalSalidas)}`, COLORS.danger, `${stats.salidasCount} salidas`);

    createInfoCard(doc, 15 + (cardWidth + cardSpacing) * 3, currentY, cardWidth, cardHeight, 'Balance Total',
        `$${formatCurrency(stats.totalBalance)}`,
        stats.totalBalance >= 0 ? COLORS.success : COLORS.danger,
        stats.totalBalance >= 0 ? 'Positivo' : 'Negativo');

    currentY += cardHeight + 8;

    // Desglose del Mes section
    currentY = addSectionHeader(doc, 'Desglose del Mes', currentY);

    createInfoCard(doc, 15, currentY, 62, cardHeight, 'Entrada Total del Mes',
        `$${formatCurrency(stats.totalEntradas)}`, COLORS.success,
        `${stats.entradasCount} transacciones`);

    createInfoCard(doc, 79, currentY, 62, cardHeight, 'Salida Total del Mes',
        `$${formatCurrency(stats.totalSalidas)}`, COLORS.danger,
        `${stats.salidasCount} transacciones`);

    createInfoCard(doc, 143, currentY, 52, cardHeight, 'Balance del Mes',
        `$${formatCurrency(stats.totalEntradas - stats.totalSalidas)}`,
        (stats.totalEntradas - stats.totalSalidas) >= 0 ? COLORS.success : COLORS.danger,
        'Solo este período');

    currentY += cardHeight + 8;

    // Payment status for expenses (salidas)
    if (stats.salidasCount > 0 && stats.paymentStatusSalidas) {
        currentY = addSectionHeader(doc, 'Estado de Salidas', currentY);

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
        Object.entries(stats.paymentStatusSalidas || {}).forEach(([status, data]) => {
            if (status !== 'pendienteAnterior' && data.count > 0) {
                createInfoCard(doc, cardX, currentY, 63, cardHeight, statusLabels[status],
                    data.count.toString(), statusColors[status],
                    `$${formatCurrency(data.amount + (data.balance || 0))}`);
                cardX += 65;
            }
        });

        currentY += cardHeight + 10;
    }

    // Payment status for income (entradas)
    if (stats.entradasCount > 0 && stats.paymentStatusEntradas) {
        currentY = addSectionHeader(doc, 'Estado de Entradas', currentY);

        const statusColors = {
            pagado: COLORS.success,
            parcial: COLORS.warning,
            pendiente: COLORS.danger
        };

        const statusLabels = {
            pagado: 'Cubiertos',
            parcial: 'Parciales',
            pendiente: 'Pendientes'
        };

        let cardX = 15;
        Object.entries(stats.paymentStatusEntradas || {}).forEach(([status, data]) => {
            if (status !== 'pendienteAnterior' && data.count > 0) {
                createInfoCard(doc, cardX, currentY, 63, cardHeight, statusLabels[status],
                    data.count.toString(), statusColors[status],
                    `$${formatCurrency(data.amount + (data.balance || 0))}`);
                cardX += 65;
            }
        });

        currentY += cardHeight + 10;
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

        const generalData = Object.entries(stats.generalBreakdown || {})
            .sort(([, a], [, b]) => (b.salidas + b.entradas) - (a.salidas + a.entradas))
            .map(([general, data]) => [
                general,
                `$${formatCurrency(data.entradas)}`,
                `$${formatCurrency(data.salidas)}`,
                `$${formatCurrency(data.entradas - data.salidas)}`,
                data.count.toString()
            ]);

        autoTable(doc, {
            startY: currentY,
            head: [['Categoría General', 'Entradas', 'Salidas', 'Balance', 'Transacciones']],
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

        const conceptData = Object.entries(stats.conceptBreakdown || {})
            .sort(([, a], [, b]) => b.total - a.total) // Sort by total amount
            .map(([concept, data]) => [
                concept,
                `$${formatCurrency(data.entradas)}`,
                `$${formatCurrency(data.salidas)}`,
                `$${formatCurrency(data.total)}`,
                data.count.toString()
            ]);

        autoTable(doc, {
            startY: currentY,
            head: [['Concepto', 'Entradas', 'Salidas', 'Total', 'Cantidad']],
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

    // Subconcept breakdown if applicable
    if (Object.keys(stats.subconceptBreakdown || {}).length > 0) {
        // Check if we need a new page
        if (currentY > 220) {
            doc.addPage();
            await addPageHeader(doc, 'Reporte Administrativo');
            currentY = 50;
        }

        currentY = addSectionHeader(doc, 'Desglose por Subconcepto', currentY);

        const subconceptData = Object.entries(stats.subconceptBreakdown || {})
            .sort(([, a], [, b]) => b.total - a.total) // Sort by total amount
            .map(([subconcept, data]) => [
                subconcept,
                `$${formatCurrency(data.entradas)}`,
                `$${formatCurrency(data.salidas)}`,
                `$${formatCurrency(data.total)}`,
                data.count.toString()
            ]);

        autoTable(doc, {
            startY: currentY,
            head: [['Subconcepto', 'Entradas', 'Salidas', 'Total', 'Cantidad']],
            body: subconceptData,
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

        const providerData = Object.entries(stats.providerBreakdown || {})
            .sort(([, a], [, b]) => b.amount - a.amount)
            .map(([provider, data]) => [
                provider,
                `$${formatCurrency(data.amount)}`,
                `$${formatCurrency(data.pendingAmount)}`,
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

    // Summary boxes for General at the end of first page
    if (currentY < 220) {
        currentY = addSectionHeader(doc, 'Resumen Final - Salidas por Categoría General', currentY);

        // General breakdown summary (only expenses)
        if (Object.keys(stats.generalBreakdown).length > 0) {
            doc.setFontSize(12);
            doc.setTextColor(...COLORS.text);
            doc.setFont('helvetica', 'bold');
            doc.text('Salidas por Categoría General:', 20, currentY + 5);

            const generalExpenses = Object.entries(stats.generalBreakdown || {})
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
                doc.text(`$${formatCurrency(safeSalidas)}`, 98, boxY + 3, { align: 'right' });
                doc.setFont('helvetica', 'normal');
                doc.text(`(${safeCount} transacciones)`, 22, boxY + 6);

                boxY += 10;
            });

            currentY = boxY + 5;
        }
    }

    // Transactions detail (limited to first 100 for performance)
    if (transactions.length > 0) {
        doc.addPage();
        await addPageHeader(doc, 'Detalle de Transacciones');

        currentY = addSectionHeader(doc, 'Listado de Transacciones', 50);

        // Get reference data for lookups
        const [concepts, providers, generals, subconcepts] = await Promise.all([
            conceptService.getAll(),
            providerService.getAll(),
            generalService.getAll(),
            subconceptService.getAll()
        ]);

        const conceptMap = {};
        concepts.forEach(concept => {
            conceptMap[concept.id] = concept.name;
        });

        const providerMap = {};
        providers.forEach(provider => {
            providerMap[provider.id] = provider.name;
        });

        const generalMap = {};
        generals.forEach(general => {
            generalMap[general.id] = general.name;
        });

        const subconceptMap = {};
        subconcepts.forEach(subconcept => {
            subconceptMap[subconcept.id] = subconcept.name;
        });

        // Filter transactions to only show those within the report period
        const filteredTransactions = transactions.filter(transaction => {
            if (!filters.startDate || !filters.endDate) {
                return true; // Si no hay filtros de fecha, mostrar todas
            }
            
            let transactionDate;
            try {
                if (transaction.date?.toDate) {
                    transactionDate = transaction.date.toDate();
                } else if (transaction.date instanceof Date) {
                    transactionDate = transaction.date;
                } else if (typeof transaction.date === 'string') {
                    const datePart = transaction.date.split('T')[0];
                    const [year, month, day] = datePart.split('-').map(Number);
                    transactionDate = new Date(year, month - 1, day);
                } else {
                    return true; // Si no se puede parsear la fecha, incluir por defecto
                }
            } catch (err) {
                console.error('Error parsing date for filter:', err, transaction.date);
                return true;
            }
            
            // Normalizar fechas para comparación (crear copias para no modificar originales)
            const txDate = new Date(transactionDate.getFullYear(), transactionDate.getMonth(), transactionDate.getDate());
            
            let filterStartDate, filterEndDate;
            if (filters.startDate instanceof Date) {
                filterStartDate = new Date(filters.startDate.getFullYear(), filters.startDate.getMonth(), filters.startDate.getDate());
            } else {
                filterStartDate = new Date(filters.startDate);
            }
            
            if (filters.endDate instanceof Date) {
                filterEndDate = new Date(filters.endDate.getFullYear(), filters.endDate.getMonth(), filters.endDate.getDate());
            } else {
                filterEndDate = new Date(filters.endDate);
            }
            
            // Incluir solo si la fecha está en el rango
            const isInRange = txDate >= filterStartDate && txDate <= filterEndDate;
            
            return isInRange;
        });

        const transactionData = filteredTransactions.slice(0, 100).map(transaction => {
            // Handle Firestore Timestamp or Date object
            let date;
            try {
                if (transaction.date?.toDate) {
                    date = transaction.date.toDate();
                } else if (transaction.date instanceof Date) {
                    date = transaction.date;
                } else if (typeof transaction.date === 'string') {
                    // If it's a string, parse as local date
                    const datePart = transaction.date.split('T')[0];
                    const [year, month, day] = datePart.split('-').map(Number);
                    date = new Date(year, month - 1, day);
                } else {
                    date = new Date();
                }
            } catch (err) {
                console.error('Error parsing transaction date:', err, transaction.date);
                date = new Date();
            }
            
            const typeText = transaction.type === 'entrada' ? 'Entrada' : 'Salida';
            const statusText = transaction.status === 'pagado' ? 'Pagado' :
                transaction.status === 'parcial' ? 'Parcial' : 'Pendiente';

            // Build concept tree: Subconcepto (bold) \n General / Concepto (normal)
            const subconceptName = subconceptMap[transaction.subconceptId] || '';
            const generalName = generalMap[transaction.generalId] || '';
            const conceptName = conceptMap[transaction.conceptId] || '';
            
            let conceptText = subconceptName || 'Sin subconcepto';
            if (generalName || conceptName) {
                conceptText += '\n' + (generalName ? generalName : '') + 
                               (generalName && conceptName ? ' / ' : '') + 
                               (conceptName ? conceptName : '');
            }

            return [
                date.toLocaleDateString('es-ES'),
                typeText,
                conceptText,
                providerMap[transaction.providerId] || 'N/A',
                `$${formatCurrency(transaction.amount)}`,
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
                fontSize: 8,
                minCellHeight: 12,
                fillColor: COLORS.white
            },
            didParseCell: function(data) {
                // Increase height for Concepto column to accommodate two lines
                if (data.column.index === 2 && data.section === 'body') {
                    data.cell.styles.minCellHeight = 12;
                }
            },
            didDrawCell: function(data) {
                // Custom draw for Concepto column to show first line in bold
                if (data.column.index === 2 && data.section === 'body') {
                    const lines = data.cell.text;
                    if (lines && lines.length > 1) {
                        // Clear the cell content first with white background
                        doc.setFillColor(...COLORS.white);
                        doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                        
                        const cellX = data.cell.x + 2;
                        let cellY = data.cell.y + 4;
                        
                        // First line (Subconcepto) in bold
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(8);
                        doc.setTextColor(...COLORS.text);
                        doc.text(lines[0], cellX, cellY);
                        
                        // Second line (General / Concepto) in normal
                        cellY += 4.5;
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(7);
                        doc.text(lines[1], cellX, cellY);
                    }
                }
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