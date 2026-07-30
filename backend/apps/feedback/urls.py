from django.urls import path

from . import views

urlpatterns = [
    path("", views.FeedbackCreateView.as_view(), name="feedback-create"),
    path("mine/", views.MyFeedbackView.as_view(), name="feedback-mine"),
    path("eligible-items/", views.EligibleFeedbackItemsView.as_view(), name="feedback-eligible-items"),
]
