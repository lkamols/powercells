# -*- coding: utf-8 -*-
"""
Created on Sat Feb  6 10:56:36 2021

@author: Luke Kamols
"""

# Python 3 server example
from http.server import BaseHTTPRequestHandler, HTTPServer
import requests
import json

hostName = "localhost"
serverPort = 8080
TIMEOUT = 4

acceptedOrigins = ["https://lkamols.github.io", "null"] #NEED TO CHANGE THIS BEFORE RELEASE TO REMOVE NULL

class MyServer(BaseHTTPRequestHandler):
    
    """
    determine whether the request comes from an acceptable origin
    """
    def valid_origin(self):
        return self.headers.get("Origin") in acceptedOrigins
    
    """
    handles receiving preflight options requests
    """
    def do_OPTIONS(self):
        print("Options request received")
        if not self.valid_origin():
            print("invalid origin - request denied")
            
        #we know that it was sent from a valid origin, allow this origin and for POST requests with jsons
        self.send_response(200, "OK")
        self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin")) #we know it is valid
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        
    """
    respond to get requests, this server doesn't need to respond to get requests, only post requests
    """
    def do_GET(self):
        print("Get request received - GET requests not handled")
        return
        
    """
    respond to post requests, should be json requests
    """
    def do_POST(self):
        print("Post request received")
        #start with a check to ensure that the origin is accepted
        if not self.valid_origin():
            print("invalid origin - request denied")
        
        #now unpack the post request into a json
        content_len = int(self.headers.get('Content-Length'))
        received_body = self.rfile.read(content_len)
        request = json.loads(received_body)
        
        #unpack the json to receive the important information, namely the type of request,
        #the url to send it to and the body of the request
        request_type = request.get("type")
        url = request.get("url")
        body_to_send = request.get("body")
        
        #do some error checking
        if request_type == None or url == None:
            print("Missing a request type or a url")
            return
        
        #send through the request to the charger now and get its response
        try:
            if request_type == "GET":
                response = requests.get(url, timeout=TIMEOUT)
            elif request_type == "POST":
                response = requests.post(url, data=body_to_send, timeout=TIMEOUT)
            else:
                print("invalid request type")
                return
            #now respond to the original request
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin"))
            self.end_headers()
            self.wfile.write(response.content)
        except requests.exceptions.RequestException as e:
            print("Request had an exception - likely incorrect ip address")
            self.send_response(404)
            self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin"))
            self.end_headers()
        


if __name__ == "__main__":        
    webServer = HTTPServer((hostName, serverPort), MyServer)
    print("Server started http://%s:%s" % (hostName, serverPort))

    try:
        webServer.serve_forever()
    except KeyboardInterrupt:
        pass

    webServer.server_close()
    print("Server stopped.")