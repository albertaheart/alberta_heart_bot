# How to update the vector store
This requires a JSON file named `serviceAccountKey.json` to be present in the `util/` directory. The file serves as a link to the shared Google Drive must be the key obtained from the [Google Cloud Console](https://cloud.google.com/).

### To create a new key:
1. Use the link above and navigate to the project (currently named My Project 12218)
2. Select **IAM & Admin**
3. Select **Service Accounts**
4. Select the account and under the **Actions** tab, click the **Manage Keys** and create the new key.
5. This should automatically download the JSON file, rename it to "serviceAccountKey.json".

### Updating the vector store:
1. Edit the name field in vectorStoreCreation.js to your choice
2. Run `vectorStoreCreation.js`
3. Copy the `id` from the console output and update the `VECTOR_STORE_ID` in the `.env` file
4. Run `addFilesToVectorStore.js`
