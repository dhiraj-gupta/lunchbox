# Lunchbox Dev Tools

Lunchbox is a wrapper for the [DrupalVM](http://drupalvm.com) project to manage your Drupal development process.

__This application is still in heavy active and early development.__


## Early demo video
[![Demo Video](http://img.youtube.com/vi/PuSqHk5zGHQ/0.jpg)](https://www.youtube.com/watch?v=PuSqHk5zGHQ)


## Instructions

Pre-requisites:

* Make sure you already have DrupalVM fully running on your machine (hoping to remove this requirement in the future)
* `npm` must be installed


Steps:

1. `git clone https://github.com/nateswart/lunchbox.git`
2. `cd lunchbox`
3. `git submodule init && git submodule update --recursive`
4. `npm install`
5. `npm start`


### Note: NFS mounting still requires user input that is not handled through the app yet (password to edit nfs exports). Watch your terminal window for the password prompt.
