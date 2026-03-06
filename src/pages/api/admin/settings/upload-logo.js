import admin, { assertAdminInitialized } from '../../../../lib/firebase/firebaseAdmin';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb', // Limit payload size to 10MB
        },
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    if (!assertAdminInitialized(res)) return;

    try {
        const { fileBase64, mimeType, fileName } = req.body;

        if (!fileBase64 || !mimeType) {
            return res.status(400).json({ message: 'Missing file data' });
        }

        const bucket = admin.storage().bucket('chago-demo.appspot.com'); // Force using this bucket
        const destination = 'branding/logo';

        const fileBuffer = Buffer.from(fileBase64, 'base64');
        const fileObj = bucket.file(destination);

        // Upload using Firebase Admin
        await fileObj.save(fileBuffer, {
            metadata: {
                contentType: mimeType,
                cacheControl: 'public, max-age=31536000',
            },
            public: true, // Make publicly accessible without tokens
        });

        // Public URL format
        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(destination)}?alt=media`;

        return res.status(200).json({ url: publicUrl });
    } catch (error) {
        console.error('API Upload error:', error);
        return res.status(500).json({ message: 'Error uploading logo', error: error.message });
    }
}
