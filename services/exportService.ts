

import { TravelRequest, TravelerDetails } from '../types';

export const exportService = {
  downloadFile: (content: string, fileName: string, contentType: string) => {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 100);
  },

  // --- CSV / Excel Exports ---
  toCSV: (data: TravelRequest[]) => {
    const headers = ["ID", "Requester", "Travel Type", "Destination", "Start Date", "End Date", "Status", "Est Cost", "Actual Cost", "SLA Deadline"];
    const rows = data.map(r => [
        r.id, 
        r.requesterName, 
        r.travelType,
        `"${r.trip.destination}"`, // Escape commas
        r.trip.startDate,
        r.trip.endDate,
        r.status,
        r.estimatedCost,
        r.actualCost || 0,
        r.slaDeadline || ''
    ]);
    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    exportService.downloadFile("\uFEFF" + csvContent, `travel_requests_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');
  },

  toJSON: (data: TravelRequest[]) => {
    const jsonContent = JSON.stringify(data, null, 2);
    exportService.downloadFile(jsonContent, `travel_requests_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
  },

  toExcelXML: (data: TravelRequest[]) => {
    let xml = '<?xml version="1.0"?>\n';
    xml += '<?mso-application progid="Excel.Sheet"?>\n';
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">\n';
    xml += ' <Worksheet ss:Name="TravelRequests">\n';
    xml += '  <Table>\n';
    
    xml += '   <Row>\n';
    ["ID", "Requester", "Destination", "Start Date", "End Date", "Status", "Cost", "SLA"].forEach(h => {
        xml += `    <Cell><Data ss:Type="String">${h}</Data></Cell>\n`;
    });
    xml += '   </Row>\n';

    data.forEach(r => {
        xml += '   <Row>\n';
        xml += `    <Cell><Data ss:Type="String">${r.id}</Data></Cell>\n`;
        xml += `    <Cell><Data ss:Type="String">${r.requesterName}</Data></Cell>\n`;
        xml += `    <Cell><Data ss:Type="String">${r.trip.destination}</Data></Cell>\n`;
        xml += `    <Cell><Data ss:Type="String">${r.trip.startDate}</Data></Cell>\n`;
        xml += `    <Cell><Data ss:Type="String">${r.trip.endDate}</Data></Cell>\n`;
        xml += `    <Cell><Data ss:Type="String">${r.status}</Data></Cell>\n`;
        xml += `    <Cell><Data ss:Type="Number">${r.actualCost || r.estimatedCost}</Data></Cell>\n`;
        xml += `    <Cell><Data ss:Type="String">${r.slaDeadline || ''}</Data></Cell>\n`;
        xml += '   </Row>\n';
    });

    xml += '  </Table>\n';
    xml += ' </Worksheet>\n';
    xml += '</Workbook>';

    exportService.downloadFile(xml, `travel_requests_${new Date().toISOString().split('T')[0]}.xls`, 'application/vnd.ms-excel');
  },

  // --- IMPORT UTILITIES ---

  downloadTravelerTemplate: () => {
      const headers = ["Title", "FullName", "EmployeeID", "Department", "JobGrade", "Position", "DateOfBirth(YYYY-MM-DD)", "PassportNo", "PassportExpiry(YYYY-MM-DD)"];
      const example = ["Mr.", "John Doe", "EMP999", "Sales", "10", "Staff", "1990-01-01", "A1234567", "2030-01-01"];
      const content = [headers.join(","), example.join(",")].join("\n");
      exportService.downloadFile("\uFEFF" + content, "traveler_import_template.csv", 'text/csv;charset=utf-8;');
  },

  parseTravelerCSV: async (file: File): Promise<TravelerDetails[]> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
              const text = e.target?.result as string;
              if (!text) {
                  resolve([]);
                  return;
              }

              const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
              // Remove Header
              if (lines.length > 0 && lines[0].toLowerCase().includes('title')) {
                  lines.shift();
              }

              const travelers: TravelerDetails[] = lines.map(line => {
                  // Basic CSV split - warning: breaks if comma in value. 
                  // For template usage, we assume simple data.
                  const cols = line.split(',').map(c => c.trim());
                  
                  return {
                      id: cols[2] || `IMP-${Math.random().toString(36).substr(2, 9)}`,
                      title: (cols[0] as any) || 'Mr.',
                      name: cols[1] || 'Unknown',
                      department: cols[3],
                      type: cols[2] ? 'Employee' : 'Guest',
                      jobGrade: parseInt(cols[4]) || 10,
                      position: (cols[5] as any) || 'Staff',
                      dateOfBirth: cols[6],
                      passportNumber: cols[7],
                      passportExpiry: cols[8]
                  };
              });
              resolve(travelers);
          };
          reader.onerror = (e) => reject(e);
          reader.readAsText(file);
      });
  }
};
