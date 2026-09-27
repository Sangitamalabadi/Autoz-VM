from django import forms
from .models import Vehicle
class VehicleForm(forms.ModelForm):
    class Meta:
        model = Vehicle
        fields = ['title','company','model_name','price','year','km_driven','category','description','image']