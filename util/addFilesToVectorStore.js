// This script was last ran on 2025-05-20

require('dotenv').config();
const { OpenAI } = require('openai');
const { google } = require('googleapis');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const auth = require('./googleAuth');
const { finished } = require('stream/promises');
const pLimit = require('p-limit');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');

const limit = pLimit.default ? pLimit.default(10) : pLimit(10);

const openai = new OpenAI({
  apiKey: process.env.CHATGPT_API_KEY,
});

const FOLDER_ID = '1yXiOs1Gup1NeDQg9FbJqUG_jJPWLL22I'; // google drive folder id

// deletes file after upload
const deleteFile = async (fileName) => {
  try {
    await fs.promises.unlink(fileName);
    console.log(`Deleted file: ${fileName}`);
  } catch (err) {
    console.error(`Error deleting file ${fileName}:`, err);
  }
};

// upload file to vector store
const uploadToVectorStore = async (jsonFileName) => {
  const file = await openai.files.create({
    file: fs.createReadStream(jsonFileName),
    purpose: 'assistants',
  });

  await openai.vectorStores.files.create(
    process.env.VECTOR_STORE_ID,
    { file_id: file.id }
  );
};

// creates a json file 
const createJsonFile = async (data, metadata) => {
  // creates json object
  const jsonContent = {
    ...metadata,
    content: data
  };
  const jsonString = JSON.stringify(jsonContent);
  // create json file with randomized name (we can actually use more detailed names relating to the file)
  const filename = `${crypto.randomUUID()}.json`;
  await fs.promises.writeFile(filename, jsonString, 'utf8');

  return filename;
};

// get text out of files since pdfs and docxs are just containers
// uploads the files to vector store
// deletes the temporary json file after upload
const processFilesAndUpload = async (filePath, ext, metaData) => { 
  if (ext === '.pdf') {
    const dataBuffer = await fs.promises.readFile(filePath);
    const parser = new PDFParse({ data: dataBuffer });
    const data = await parser.getText();
    const jsonFileName = await createJsonFile(data.text, metaData);
    await uploadToVectorStore(jsonFileName);
    await deleteFile(jsonFileName);
  } 
  else if (ext === '.docx') {
    const data = await mammoth.extractRawText({ path: filePath });
    const jsonFileName = await createJsonFile(data.value, metaData);
    await uploadToVectorStore(jsonFileName);
    await deleteFile(jsonFileName);
  } 
  else if (ext === '.txt') {
    const data = await fs.promises.readFile(filePath, 'utf8');
    const jsonFileName = await createJsonFile(data, metaData);
    await uploadToVectorStore(jsonFileName);
    await deleteFile(jsonFileName);
  }
};

// downloads file, returns the path to the downloaded file, and a randomized name for the file (since google drive files can have duplicate names)
const downloadFile = async (drive, file) => {
  const mt = file.mimeType; // extensions basically
  let fileName = `${crypto.randomUUID()}`;

  // check extenstion type
  const isPDF = mt === 'application/pdf';
  const isTXT = mt === 'text/plain';
  const isWord = mt === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const isGoogleDoc = mt === 'application/vnd.google-apps.document';

  // only process supported file types, otherwise return null
  if (isPDF || isTXT || isWord || isGoogleDoc) {
    console.log(`Processing ${mt}`);

    try {
      if (isPDF) fileName += '.pdf';
      else if (isWord || isGoogleDoc) fileName += '.docx';
      else if (isTXT) fileName += '.txt';

      // gets the file as a stream, if its a google doc, we have to export it as a docx first, otherwise we can just get the media
      const method = isGoogleDoc ? 'export' : 'get';
      
      const params = isGoogleDoc 
        ? { fileId: file.id, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
        : { fileId: file.id, alt: 'media' }; 

      const res = await drive.files[method](params, { responseType: 'stream' });

      // pipe the stream to a local file
      const destinationPath = `./${fileName}`;
      const destination = fs.createWriteStream(destinationPath); 
      res.data.pipe(destination);

      // wait for the download to finish
      await finished(destination); 
      console.log(`Saved ${fileName}`);

      return { fileName: fileName, filePath: destinationPath };

    } catch (err) {
      console.error(`Error downloading file ${file.name}:`, err);
      return null;
    }
  } 

  return null; // unsupported file type
};

// recursively navigate through folders and process files
const fetchFilesRecursive = async (FOLDER_ID, currentPath = 'root') => {
  // connect to the drive api
  const drive = google.drive({ version: 'v3', auth });
  let pageToken = null; // counter for pagination

  do {
    // get list of files with meta data, uses pegination
    const res = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageSize: 100,
      pageToken: pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    }).catch(err => {
      console.error('Drive API error:', err.message);
      return { data: { files: [] } };
    });

    console.log(`Found ${res.data.files.length} files in ${currentPath}`);

    for (const file of res.data.files) {
      const relativePath = `${currentPath}/${file.name}`; // construct relative path for file

      // if its a folder, then recurse
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        console.log(`Entering folder: ${relativePath}`);
        await fetchFilesRecursive(file.id, relativePath);
      } 
      // if its a file then download, process, and upload to vector store
      else {
        // concurrency
        limit(async () => {
          const result = await downloadFile(drive, file);
          if (result) {
            const ext = path.extname(result.fileName).toLowerCase();
            
            // structure metadata
            const metaData = {
              name: file.name,
              relativePath: relativePath
            };

            await processFilesAndUpload(result.filePath, ext, metaData);
            await deleteFile(result.filePath);
          }
        });
      }
    };
      
    pageToken = res.data.nextPageToken;
  } while (pageToken);
};

const main = async () => {
  console.log('Starting...');
  await fetchFilesRecursive(FOLDER_ID, 'root');

  // wait for any remaining file uploads in the queue to finish
  while (limit.activeCount > 0 || limit.pendingCount > 0) {
    console.log(`Waiting for remaining tasks (Active: ${limit.activeCount}, Pending: ${limit.pendingCount})`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
};

main();