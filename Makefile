SHELL=bash
.ONESHELL:

MAKEFILE_PATH := $(abspath $(lastword $(MAKEFILE_LIST)))
##########################
IMAGE_NAME=vercel-subdomain-dns-updater

PWD := $(shell (dirname $(MAKEFILE_PATH)))
##############
all: run

run: docker.build 
	docker run -ti \
		--rm \
		--name $(IMAGE_NAME) \
		-v $(PWD):/app \
		$(IMAGE_NAME)

docker.build:
	docker build \
		--no-cache \
		$(PWD) \
		-f Dockerfile \
		-t $(IMAGE_NAME):latest