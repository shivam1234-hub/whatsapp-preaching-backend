const fs = require('fs');
const { GridFSBucket } = require('mongodb');



class SessionStore {
    constructor(mongoose) {
        this.mongoose = mongoose;
    }

    async sessionExists(options) {
        const collection = this.mongoose.connection.db.collection(`whatsapp-${options.session}.files`);
        const hasSession = await collection.countDocuments();
        return !!hasSession;
    }

    async save(options) {
        const bucket = new GridFSBucket(this.mongoose.connection.db, {
            bucketName: `whatsapp-${options.session}`,
        });
        const zipPath = `${options.session}.zip`;
        const uploadStream = bucket.openUploadStream(zipPath);
        const readStream = fs.createReadStream(zipPath);
        await new Promise((resolve, reject) => {
            readStream.pipe(uploadStream).on('error', reject).on('finish', resolve);
        });
        await this.deletePrevious(bucket, options.session);
    }

    async extract(options) {
        const bucket = new GridFSBucket(this.mongoose.connection.db, {
            bucketName: `whatsapp-${options.session}`,
        });
        const zipPath = `${options.path}`;
        return new Promise((resolve, reject) => {
            bucket.openDownloadStreamByName(`${options.session}.zip`)
                .pipe(fs.createWriteStream(zipPath))
                .on('error', reject)
                .on('finish', resolve);
        });
    }

    async delete(options) {
        const bucket = new GridFSBucket(this.mongoose.connection.db, {
            bucketName: `whatsapp-${options.session}`,
        });
        const files = await bucket.find({ filename: `${options.session}.zip` }).toArray();
        await Promise.all(files.map(doc => bucket.delete(doc._id)));
    }

    async deletePrevious(bucket, session) {
        const files = await bucket.find({ filename: `${session}.zip` }).toArray();
        if (files.length > 1) {
            const oldest = files.reduce((a, b) => a.uploadDate < b.uploadDate ? a : b);
            await bucket.delete(oldest._id);
        }
    }
}

module.exports = SessionStore;




