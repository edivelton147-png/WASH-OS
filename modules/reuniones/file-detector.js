window.WashMeetingsFileDetector = (function(){
  const EXTENSION_TYPES = {
    mp3:'audio', wav:'audio', m4a:'audio',
    pdf:'pdf',
    docx:'docx',
    png:'image', jpg:'image', jpeg:'image',
    txt:'text'
  };
  const TYPE_META = {
    audio:{icon:'🎧',label:'Audio',status:'Transcripción IA preparada'},
    pdf:{icon:'📕',label:'PDF',status:'Extracción/OCR preparado'},
    docx:{icon:'📘',label:'DOCX',status:'Lectura estructurada'},
    image:{icon:'🖼️',label:'Imagen',status:'OCR preparado'},
    text:{icon:'📝',label:'Texto',status:'Análisis directo'},
    unknown:{icon:'📎',label:'Archivo',status:'Tipo no reconocido'}
  };

  function extension(file){return (file?.name||'').split('.').pop().toLowerCase();}
  function detectFileType(file){
    const mime=file?.type||'';
    const ext=extension(file);
    if(mime.startsWith('audio/'))return 'audio';
    if(mime==='application/pdf'||ext==='pdf')return 'pdf';
    if(mime.includes('wordprocessingml')||ext==='docx')return 'docx';
    if(mime.startsWith('image/')||['png','jpg','jpeg'].includes(ext))return 'image';
    if(mime.startsWith('text/')||ext==='txt')return 'text';
    return EXTENSION_TYPES[ext]||'unknown';
  }
  function metaForType(type){return TYPE_META[type]||TYPE_META.unknown;}

  return { detectFileType, metaForType };
})();
