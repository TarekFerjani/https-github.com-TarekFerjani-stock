import React from 'react';

interface PDFViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfDataUri: string;
  fileName: string;
}

const PDFViewerModal: React.FC<PDFViewerModalProps> = ({ isOpen, onClose, pdfDataUri, fileName }) => {
  if (!isOpen) return null;

  const printPdf = () => {
    const iframe = document.getElementById('pdf-iframe') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
  };
  
  const downloadPdf = () => {
    const link = document.createElement('a');
    link.href = pdfDataUri;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-800">Aperçu du Document</h3>
          <div className="flex items-center space-x-2">
            <button onClick={printPdf} className="px-4 py-2 text-sm bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Imprimer</button>
            <button onClick={downloadPdf} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700">Télécharger</button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
          </div>
        </div>
        <div className="flex-grow p-2 bg-gray-100">
          <iframe
            id="pdf-iframe"
            src={pdfDataUri}
            title="Aperçu PDF"
            className="w-full h-full border-none"
          />
        </div>
      </div>
    </div>
  );
};

export default PDFViewerModal;
