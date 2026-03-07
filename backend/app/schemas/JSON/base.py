class JsonBase():
    def to_dict(self):
        return vars(self)
