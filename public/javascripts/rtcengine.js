/* globals io:true, Peer:true, mediaDevices:true, logError:true, */

function RTCEngine(){
    var peers = []
        , peer = null
        , socket = null
        , roomName = null
        , isLocked = null
        , password = null
        , localStream = null
        , localId = null
        , stunOn = true
        , appCB = function(){}; // holds the callback from external app

    let iceConfig = [{urls: "stun:stun.l.google.com:19302"}];

    var shiftKeyCode = {'192':'126', '49':'33', '50':'64', '51':'35', '52':'36', '53':'37', '54':'94', '55':'38', '56':'42', '57':'40', '48':'41', '189':'95', '187':'43', '219':'123', '221':'125', '220':'124', '186':'58', '222':'34', '188':'60', '190':'62', '191':'63'};
    var specialCharCode = {'8':'8', '13':'13', '32':'32', '186':'58', '187':'61', '188':'44', '189':'45', '190':'46', '191':'47', '192':'96', '219':'91', '220':'92', '221':'93', '222':'39'};

    function startMedia(data){
        if (data && data.room){
            roomName = data.room;
        }
        if ( data && data.password){
            isLocked = true;
            password = data.password;
            console.log('password', password);
        }
        const defaultConstraints = window.constraints = {
            video : true
            , audio : true
        };

        const hdConstraints = {
            video: { width: { min: 1280 }, height: { min: 720 } }
            , audio : true
        };

        const vgaConstraints = {
            video: { width: { exact: 640 }, height: { exact: 480 } }
            , audio : true
        };

        const qvgaConstraints = {
            video: { width: { exact: 320 }, height: { exact: 240 } }
            , audio : true
        };

        // getUserMedia
        try {
            navigator.mediaDevices.getUserMedia(qvgaConstraints)
            .then(function(stream){

                const videoTracks = stream.getVideoTracks();
                console.log('Got stream with constraints:', constraints);
                console.log(`Using video device: ${videoTracks[0].label}`);

                localStream = stream;
                window.stream = stream;
                var video = document.querySelector('#local-video');
                video.srcObject = stream;
                console.log('joining', roomName);
                var info = {
                    room: roomName
                    , stunOn: stunOn
                    , isLocked: isLocked
                    , password: password
                };
                socket.emit('join', info);
            })
        } catch(err){
            console.log('getUserMedia error: ', err);
            if(socket){
                socket.disconnect();
            }
        }
    }

    function stopMedia(){
        closeLocalMedia();
        while (peers.length > 0){
            peer = peers.pop();
            peer.close();
        }
        if(socket){
            //socket.emit('exit');
            socket.disconnect();
        }
    }

    function closeLocalMedia(){
        if (localStream){
            var tracks = localStream.getTracks();
            for (var i = 0; i < tracks.length; i++){
                tracks[i].stop();
            }
        }
    }

    // data = {room:room, isLocked:isLocked, password:password}
    //
    function createRoom(data){
        if (socket){

            if (data.isLocked)
                isLocked = data.isLocked;
            if (data.password)
                password = data.password;
            if (data.room)
                roomName = data.room;

            socket.emit('createRoom', data);
        }
    }

    function getRooms(){
        console.log('rtcengine getRooms');
        if (socket){
            socket.emit('getRooms');
        }
    }

    function sendChar(code, isrelay){
        if (roomName){
            var message = {
                room: roomName,
                code: code
            };
            if (isrelay){
                //console.log('relaying',message);
                socket.emit('byteChar', message);
            } else {
                for(var i = 0; i < peers.length; i++){
                    peers[i].sendData(code);
                }
            }
        }
    }

    function sendString(word, isrelay){
        if (roomName){
            var message = {
                room: roomName,
                code: word
            };
            if (isrelay){
                console.log('sendString using WebSocket');
                socket.emit('byteChar', message);
            } else {
                for(var i = 0; i < peers.length; i++){
                    console.log('sendString using datachannel to peer',i);
                    peers[i].sendData(word);
                }
            }
        }
    }

    function handleRoomsSent(socket, callback){
        if (typeof callback === 'undefined') callback = function() {};
        socket.on('roomsSent', function(data){
            callback('roomsSent', data);
        });
    }

    function handleAddRoom(socket, callback){
        if (typeof callback === 'undefined') callback = function() {};
        socket.on('addRoom', function(data){
            callback('addRoom', data);
        });
    }

    function handleDeleteRoom(socket, callback){
        if (typeof callback === 'undefined') callback = function(){};
        socket.on('deleteRoom', function(data){
            callback('deleteRoom', data);
        });
    }

    function handleJoinRoom(socket, callback) {
        if (typeof callback === 'undefined') callback = function(){};
        socket.on('id', function(message){
            localId = message.yourId;
            console.log('localId: ' + localId);
            callback('id', {id:localId});
        });
    }

    function handleCreateRoom(socket, callback) {
        if (typeof callback === 'undefined') callback = function(){};
        socket.on('roomCreated', function(message){
            console.log('rtcengine: handleCreateRoom - room created? ' + message.created);
            callback('roomCreated', message);
        });
    }

    function handleCreatePeers(socket,callback) {
        if (typeof callback === 'undefined') callback = function(){};
        socket.on('createPeers', function(message){
            console.log('socket received createPeers signal');
            var users = message.users;
            var len = message.len;

            var ice = message.ice ? message.ice : iceConfig;
            console.log('handleCreatePeers users:', users);
            if(users.length > 0)
                createPeers(users, ice, callback);
            socket.emit('broadcastJoin', {room:roomName, stunOn: stunOn});
        });
    }

    async function createPeers(users, ice, callback) {
        var pid = users.shift();
        console.log('Shifting to next peer.');
        if(callback('create', {id:pid})){
            console.log('createPeers iceConfig: ', ice);
            var peer = new Peer(socket, pid, roomName, ice);
            peer.buildClient(localStream, handleByteChar, 'answer');
            peers.push(peer);
            if(users.length > 0){
                createPeers(users, ice, callback);
            }
        } else {
            console.log('createPeers failed to add new peer.'); 
            if(users.length > 0){
                createPeers(users, ice, callback);
            }
        }
    }

    function handleCreateOffer(socket, callback) {
        if (typeof callback === 'undefined') callback = function(){};
        socket.on('createOffer', function(message){
            iceConfig = message.ice ? message.ice : iceConfig;
            console.log('createOffer iceConfig: ', iceConfig);
            var peer = new Peer(socket, message.id, roomName, iceConfig);
            peer.buildClient(localStream, handleByteChar, 'offer');
            peers.push(peer);
            callback('create', {id:message.id});
            peer.peerCreateOffer();
        });
    }

    function handleIceCandidate(socket) {
        socket.on('candidate', function(message) {
            for(var i = 0; i < peers.length; i++){
                if(peers[i].getid() === message.from_id) {
                    if(!peers[i].hasPC()){
                        console.log('ICE Candidate received: PC not ready. Building.');
                        peers[i].buildClient(localStream, handleByteChar, 'answer');
                    }
                    console.log('Remote ICE candidate',message.candidate.candidate);
                    peers[i].addIceCandidate(message.candidate);
                }
            }
        });
    }

    function handleSetRemoteDescription(socket) {
        socket.on('sdp', function (message) {
            console.log('sdp offer received');
            for(var i = 0; i < peers.length; i++) {
                //console.log(`sdp offer for peerid: ${peers[i].getid()}`);
                //console.log(`sdp offer from message.from_id: ${message.from_id}`);
                if(peers[i].getid() === message.from_id){
                    if(!peers[i].hasPC()){
                        console.log('SDP received: PC not ready. Building.');
                        peers[i].buildClient(localStream, handleByteChar, 'answer');
                    }
                    peers[i].setRemoteDescription(message.sdp);
                }
            }
        });
    }

    function handleClientDisconnected(socket, callback) {
        if (typeof callback === 'undefined') callback = function(){};
        socket.on('leave', function (from_id) {
            console.log('handleClientDisconnected', from_id);
            for(var i = 0; i < peers.length; i++) {
                if(peers[i].getid() === from_id){
                    if(peers[i].hasPC()){
                        peers.splice(i, 1);
                        callback('peerDisconnect', {id:from_id});
                        return;
                    }
                }
            }
        });
    }

    function handleSysCode(socket, callback) {
        if (typeof callback === 'undefined') callback = function(){};
        socket.on('err', function(message) {
            console.log('handleSysCode', message.errcode);
            callback('error', message);
        });
        socket.on('info', function(message){
            var code;
            switch (message.info) {
                case 'room empty': 
                    code = 'Room is empty';
                    break;
                default:
                    code = 'Unknown Error';
                    break;
            }
            callback('info', {msg:code});
        });
    }

    // DataChannel version of sending char code
    // message consists of:
    // message.from_id
    // message.code
    function handleByteChar(message){
        for (var i = 0; i < peers.length; i++) {
            if (peers[i].getid() === message.from_id){
                if (!peers[i].hasPC()){
                    console.log('Message received: PC not ready.');
                } else {
                    appCB('readbytechar', message);
                }
                return {};
            }
        }
    }

    // WebSocket version of sending char code
    function handleReceiveCode(socket, callback) {
        if (typeof callback === 'undefined') callback = function(){};
        socket.on('byteChar', function(message) {
            for (var i = 0; i < peers.length; i++) {
                if (peers[i].getid() === message.from_id){
                    if (!peers[i].hasPC()){
                        console.log('Message received: PC not ready.');
                    } else {
                        callback('readbytechar', message);
                        //console.log('handleReceiveCode', message.code);
                    }
                    return {};
                }
            }
        });
    }

    /*
    function handleIceConfig(socket){
        socket.on('iceConfig', function(ice){
            console.log('iceConfig received: ', ice);
            console.log('handleIceConfig before updating ice: ', iceConfig);
            if (ice.length > 0){
                iceConfig = ice; 
            }
        });
    }
    */

    function connect(callback) {

        /* callback from handleSocketEvents MVC  */
        appCB = callback;

        if(socket){
            console.log('socket reconnecting');
            socket.reconnect();
        } else {
            console.log('creating new socket connection');
            socket = io({ forceNew: true }); 
        }
        socket.on('connect', function(){
            console.log('socket connected');
            handleCreateRoom(socket, callback);
            handleRoomsSent(socket, callback);
            handleDeleteRoom(socket, callback);
            handleAddRoom(socket, callback);
            handleJoinRoom(socket, callback);
            handleCreatePeers(socket, callback);
            handleCreateOffer(socket, callback);
            handleIceCandidate(socket);
            handleSetRemoteDescription(socket);
            handleReceiveCode(socket, callback);
            handleClientDisconnected(socket, callback);
            handleSysCode(socket, callback);
    //        handleIceConfig(socket);

            callback('connected');

        });
    }

    function S4() {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    }

    function generateID () {
        return (S4() + S4() + '-' + S4() + '-' + S4() + '-' + S4() + '-' + S4() + S4() + S4());
    }

    function getURL () {
        var pathArray = window.location.href.split('/');
        var protocol = pathArray[0];
        var host = pathArray[2];
        var url = protocol + '//' + host;
        for(var i = 3; i < pathArray.length; i++){
            url += '/' + pathArray[i];
        }
        return url;
    }

    return {
        connect:connect, 
        join:startMedia, 
        leave:stopMedia, 
        closeLocalMedia:closeLocalMedia,
        createRoom:createRoom,
        getRooms:getRooms,
        sendChar:sendChar,
        sendString:sendString
    };
}
