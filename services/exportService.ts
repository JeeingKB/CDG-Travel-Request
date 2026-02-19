
import { TravelRequest, TravelerDetails, TravelType, RequestStatus, ServiceType } from '../types';

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

  downloadRequestTemplate: () => {
      // Detailed CSV structure with Field Types aligned with NewRequestForm
      const headers = [
          "RequesterID [String]", 
          "TravelType [DOMESTIC/INTERNATIONAL]", 
          "RequestFor [SELF/EMPLOYEE/CLIENT]", 
          "Origin [City/Airport]", 
          "Destination [City/Airport]", 
          "StartDate [YYYY-MM-DD]", 
          "EndDate [YYYY-MM-DD]", 
          "Purpose [String]", 
          "Justification [String]", 
          "BillableTo [String]", 
          "ProjectCode [String]", 
          "CostCenter [String]", 
          "EstCost [Number]",
          "ServiceType [FLIGHT/HOTEL/CAR]",
          "ServiceDetail [String]"
      ];
      const example = [
          "EMP001", 
          "DOMESTIC",
          "SELF", 
          "Bangkok", 
          "Phuket", 
          new Date().toISOString().split('T')[0], 
          new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0], 
          "Site Survey", 
          "Annual site inspection required for compliance.",
          "Client A",
          "PRJ-2024-001", 
          "CC-GEN-001", 
          "5000",
          "FLIGHT",
          "Morning flight preferred"
      ];
      const content = [headers.join(","), example.join(",")].join("\n");
      exportService.downloadFile("\uFEFF" + content, "request_import_template_v3.csv", 'text/csv;charset=utf-8;');
  },

  parseRequestCSV: async (file: File): Promise<Partial<TravelRequest>[]> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
              const text = e.target?.result as string;
              if (!text) {
                  resolve([]);
                  return;
              }

              const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
              // Check/Remove Header (detect if first line contains brackets which indicates our template)
              if (lines.length > 0 && lines[0].toLowerCase().includes('requesterid')) {
                  lines.shift();
              }

              const requests: Partial<TravelRequest>[] = lines.map((line, index) => {
                  // Basic CSV split
                  const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                  
                  // Map columns to Request Object based on new template v3
                  // 0:RequesterID, 1:TravelType, 2:RequestFor, 3:Origin, 4:Destination, 5:Start, 6:End, 
                  // 7:Purpose, 8:Justification, 9:BillableTo, 10:Project, 11:CostCenter, 12:Cost, 13:SvcType, 14:SvcDetail
                  
                  const travelType = cols[1]?.toUpperCase() === 'INTERNATIONAL' ? 'INTERNATIONAL' : 'DOMESTIC';
                  const requestFor = ['EMPLOYEE', 'CLIENT'].includes(cols[2]?.toUpperCase()) ? cols[2].toUpperCase() : 'SELF';

                  // Construct Services if provided
                  const services = [];
                  if (cols[13]) {
                      const svcType = cols[13].toUpperCase().trim();
                      const svcDetail = cols[14] || '';
                      
                      // Basic mapping for creating a service stub
                      let newService: any = {
                          id: `IMP-SVC-${index}`,
                          type: svcType as ServiceType,
                          assignedTravelerIds: [], // Default to all
                      };

                      if (svcType === 'FLIGHT') {
                          newService = { ...newService, from: cols[3], to: cols[4], departureDate: cols[5], airlinePreference: svcDetail };
                      } else if (svcType === 'HOTEL') {
                          newService = { ...newService, location: cols[4], checkIn: cols[5], checkOut: cols[6], hotelName: svcDetail };
                      } else {
                          newService = { ...newService, notes: svcDetail };
                      }
                      
                      // Only add if type is valid
                      if (['FLIGHT', 'HOTEL', 'CAR', 'TRAIN', 'BUS', 'INSURANCE', 'EVENT'].includes(svcType)) {
                          services.push(newService);
                      }
                  }

                  return {
                      // Temporary ID
                      id: `IMP-${Date.now()}-${index}`, 
                      requesterId: cols[0] || 'UNKNOWN',
                      travelType: travelType as TravelType,
                      requestFor: requestFor as any,
                      status: RequestStatus.DRAFT, 
                      estimatedCost: parseFloat(cols[12]) || 0,
                      trip: {
                          origin: cols[3] || 'Bangkok',
                          destination: cols[4] || 'Unknown',
                          startDate: cols[5] || new Date().toISOString().split('T')[0],
                          endDate: cols[6] || new Date().toISOString().split('T')[0],
                          purpose: cols[7] || 'Imported Request',
                          justification: cols[8] || 'Imported via Bulk CSV',
                          billableTo: cols[9] || '',
                          projectCode: cols[10] || '',
                          costCenter: cols[11] || ''
                      },
                      travelers: [], // Will be filled by system using requesterId
                      services: services
                  } as Partial<TravelRequest>;
              });
              resolve(requests);
          };
          reader.onerror = (e) => reject(e);
          reader.readAsText(file);
      });
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
