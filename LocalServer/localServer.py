# -*- coding: utf-8 -*-
"""
Created on Sat Feb  6 10:56:36 2021

@author: Luke Kamols
"""

# Python 3 server example
from http.server import BaseHTTPRequestHandler, HTTPServer
import requests
import json
import configparser
import socket
from contextlib import closing

#DEFAULT VALUES FOR CONFIGURATION RECOVERY
DEFAULTS = {
        "ports" : "8080, 57923",
        "timeout" : "4",
        "origins" : "null, lkamols@github.io/powercells"}

HOSTNAME = "localhost" #this is entirely designed to run on localhost so don't need to consider others

#CONFIGURATION FILE LOCATIONS
CONFIG_FILE_LOCATION = "config.txt"
CONFIG_SECTION_TITLE = "SETTINGS"
CONFIGURATION_READ_ATTEMPTS = 10 #just a bound on the attempts to read configuration file, avoids a while(1)


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
            return
            
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
            return
        
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
        except requests.exceptions.RequestException:
            print("Request had an exception - likely incorrect ip address")
            self.send_response(404)
            self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin"))
            self.end_headers()       

"""
reads the configuration file, returning the configuration object and the settings section dictionary
if the configuration file does not exist or is missing the section header, creates a new one
"""
def read_configuration_file():
    for attempt in range(CONFIGURATION_READ_ATTEMPTS):
        try:
            config = configparser.ConfigParser()
            with open(CONFIG_FILE_LOCATION, 'r') as config_file:
                config.read_file(config_file)
            settings = config[CONFIG_SECTION_TITLE]
            return config, settings
        except FileNotFoundError:
            print("{0} did not exist, creating it".format(CONFIG_FILE_LOCATION))
            create_empty_config()
        except KeyError:
            print("{0} section did not exist, creating it".format(CONFIG_SECTION_TITLE))
            create_empty_config()    

"""
create an empty configuration file, with the section title
"""
def create_empty_config():
    #if this doesn't work, we can't really recover from it, just accept the exception, very unlikely
    newfile = open(CONFIG_FILE_LOCATION, 'w')
    newfile.write("[{0}]".format(CONFIG_SECTION_TITLE))
    newfile.close()
    
"""
read in the configuration file and recover any missing information
settings - the settings configuration dictionary
"""    
def fill_default_values(settings):
    #go through the defaults dictionary and load any values if they don't exist
    for setting in DEFAULTS:
        if settings.get(setting) == None:
            settings[setting] = DEFAULTS[setting]
        
"""
returns an available port number to be used, gives priority to the ports in the settings
"""    
def get_available_port(settings):
    #first collect all the lists, configuration file only has strings, so convert to an int list
    port_list = [int(s.strip()) for s in settings["ports"].split(',')]
    
    #check the existing list of ports for one that is available
    for port in port_list:
        with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as dummy_socket:
            location = ('127.0.0.1', port)
            if dummy_socket.connect_ex(location) != 0:
                #the connection was unsuccessful - so it doesn't exist and we can use it
                return port #assign this as the used port
    else:
        #no ports were found, assign one using the socket assignment system
        with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as dummy_socket:
            dummy_socket.bind(('',0)) 
            port = dummy_socket.getsockname()[1]
            #update the settings list
            settings["ports"] += ",{0:.0f}".format(port)
            return port

if __name__ == "__main__":    
    #set up the configuration file and ensure it exists
    config, settings = read_configuration_file()
    
    #then fill in any missing default values
    fill_default_values(settings)
    
    #determine which port to use
    port = get_available_port(settings)
    print("The port being used is: {0:.0f}".format(port))
        
    
    #update the configuration file
    with open(CONFIG_FILE_LOCATION, 'w') as config_file:
        config.write(config_file)

    
    webServer = HTTPServer((HOSTNAME, port), MyServer)
    print("Server started http://%s:%s" % (HOSTNAME, port))

    try:
        webServer.serve_forever()
    except KeyboardInterrupt:
        pass

    webServer.server_close()
    print("Server stopped.")