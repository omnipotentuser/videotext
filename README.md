# videotext

### reading materials ###
https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/ontrack
https://developer.mozilla.org/en-US/docs/Web/API/RTCIceServer/urls
https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API
https://webrtchacks.com/guide-to-safari-webrtc/

### usage ###
This project is a simple, intuitive implementation of a videochat WebRTC app with a login system and psql (although you are free to devise your own database). 

Each party layout with the local video and all peers (remote) comes with text box below each video. In your local video, begin typing in the textbox and the characters will be sent REAL TIME to all other users end where your video appears.

Pasting a string of words to be sent to peers will not work where you normally would text type. To send a block or string of characters at once, you need to use the *paste clipboard* textbox.
