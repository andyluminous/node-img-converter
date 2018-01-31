const   net = require('net'),
        gm = require('gm'),
        request = require('request'),
        dotenv = require('dotenv'),
        aws = require('aws-sdk');

dotenv.load({ path: '.env' });

const   hostname = '0.0.0.0',
        port = 3001,
        awsID /* ENV VAR HERE */,
        awsSecret /* ENV VAR HERE */,
        awsBucket /* ENV VAR HERE */,
        awsRegion /* ENV VAR HERE */;

// creating TCP server

net.createServer(function(socket) {
    
    console.log(`CONNECTED: ${socket.remoteAddress}:${socket.remotePort}`);
    
    socket.on('data', function(data) {

        // setting up AWS sdk

        aws.config.update({ accessKeyId: awsID, secretAccessKey: awsSecret, region: awsRegion });
        let s3 = new aws.S3(),
            dataObj,
            urlToConvert,
            uploadKey;
        
        

        try {
            dataObj = JSON.parse(data);
        } catch (err) {
            socket.write(`Bad input data: ${err}`);
            return;
        }

        if (dataObj) {
            if (dataObj.action == 'convertQr') {
                urlToConvert = `http://${awsBucket}.s3.amazonaws.com/posters/${dataObj.posterId}_qr_pdf`;
                uploadKey = `posters/${dataObj.posterId}_qr_png`
            } else {
                socket.write('Invalid action type');
                return;
            }

            var s3_params_convert = {
                Bucket      : awsBucket,
                Key         : uploadKey,
                Expires     : 600,
                ContentType : 'image/png',
                ACL         : 'public-read',
            }

            if (dataObj && dataObj.type == 'pdf') {
                // getting signed URL for file upload
                s3.getSignedUrl('putObject', s3_params_convert, function(err, convertData) {
                    if (err) {
                        console.log(err);
                    }
                    // converting file
                    gm(request.get(urlToConvert), 'img.pdf').setFormat('png').quality(100).toBuffer(function (err, buffer) {
                        if (err) console.log(err);
                        // uploading converted file
                        request({ 
                            url: convertData, 
                            method: 'PUT', 
                            headers: {'x-amz-acl': 'public-read', 'Content-type': 'image/png'},
                            body: buffer
                        }, function(response) {
                            socket.write('Converted');
                        });
                    });
                });
            }
        }
    });
    
    socket.on('close', function(data) {
        console.log(`CLOSED: ${socket.remoteAddress}:${socket.remotePort}`);
    });
    
}).listen(port, hostname);

console.log(`Node server is listening on port ${port}`);