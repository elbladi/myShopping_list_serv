const fs = require('fs').promises
const path = require('path')


module.exports = async (req, res, next) => {

    try {
        const FOLDER_TO_REMOVE = '/image/tempImg';
        await fs.readdir(FOLDER_TO_REMOVE).then(files => {
            if (files.length === 0) return;
            files.map(file => {
                const filePath = path.join(FOLDER_TO_REMOVE, file)
                fs.unlink(filePath);
            }) 
        }).catch(err => {
            next();
        })

        next();
    } catch (error) {
        console.log('error:')
        console.log(error);
        next();
    }

}